using Net.Pkcs11Interop.Common;
using Net.Pkcs11Interop.HighLevelAPI;
using Org.BouncyCastle.Asn1;
using Org.BouncyCastle.Asn1.Ess;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Security.Cryptography.Pkcs;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.IO;
using System.Buffers.Text;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json;

public sealed class CertificateInfo
{
    public string FriendlyName { get; set; } = "";
    public string IssuedBy { get; set; } = "";
    public string IssuedTo { get; set; } = "";
    public string SignatureAlgorithm { get; set; } = "";
    public string SerialNumber { get; set; } = "";
    public string ContentType { get; set; } = "";
    public string ExpirationDate { get; set; } = "";
    public bool IsVerified { get; set; }
    public bool Archived { get; set; }
    public int RawDataLength { get; set; }
    public string CertThumprint { get; set; } = "";
    public bool HasPrivateKey { get; set; }
}

public sealed class SignRequest
{
    public string Action { get; set; } = "";
    public string Thumbprint { get; set; } = "";
    public string Document { get; set; } = "";
    public string TokenPin { get; set; } = "";
}

public class TokenSigner
{
    private readonly string DllLibPath = @"D:\Program Files\SoftHSM2\lib\softhsm2-x64.dll";
    // private readonly string DllLibPath = @"C:\Windows\System32\eps2003csp11.dll";
    private string Document = "";
    private string TokenCertificate = "CERTIFICATE_THUMBPRINT";
    private string TokenPin = "";
    private string FileFormat = "JSON";

    private static TokenSigner tokenSigner;

    public static void Main(String[] args)
    {
        Console.InputEncoding = Encoding.UTF8;
        Console.OutputEncoding = Encoding.UTF8;

        try {
            TokenSigner.tokenSigner = new TokenSigner();

            if(args == null || args.Length == 0)
            {
                string line = Console.ReadLine();
                if(string.IsNullOrWhiteSpace(line))
                {
                    return;
                }

                var request = JsonConvert.DeserializeObject<SignRequest>(line);
                if (request == null)
                {
                    throw new Exception("Invalid request");
                }

                if (request.Action == "sign")
                {
                    tokenSigner.Document = request.Document;
                    tokenSigner.TokenCertificate = request.Thumbprint;
                    tokenSigner.TokenPin = request.TokenPin;
                    // tokenSigner.FileFormat = request.FileFormat.ToUpper();
                }
            }
            else if(args[0] == "cert")
            {
                var certificates = ListCertificates();
                Console.WriteLine(JsonConvert.SerializeObject(certificates));
                return;
            }
            else
            {
                Console.WriteLine(JsonConvert.SerializeObject(new { success = false, error = "Unknown action" }));
                return;
            }

            if(tokenSigner.FileFormat != "JSON")
            {
                Console.WriteLine(JsonConvert.SerializeObject(new
                {
                    success = false,
                    error = $"Unsupported file format '{tokenSigner.FileFormat}'. Only JSON is allowed."
                }));

                return;
            }

            if(!Base64.IsValid(tokenSigner.Document))
            {
                Console.WriteLine(JsonConvert.SerializeObject(new
                {
                    success = false,
                    error = "The document to be signed is not a valid Base64 string."
                }));

                return;
            }

            byte[] documentBytes = Convert.FromBase64String(tokenSigner.Document);
            string sourceDocument = Encoding.UTF8.GetString(documentBytes);
            JObject signature = tokenSigner.processJSON(sourceDocument);

            Console.WriteLine(JsonConvert.SerializeObject(new { success = true, signature }));
        }
        catch(Exception e)
        {
            Console.Error.WriteLine(e);
            Console.WriteLine(JsonConvert.SerializeObject(new { success = false, error = e.Message }));
        }
    }

    private JObject processJSON(string SourceDocumentJson) {
        String cades;
        JArray singleDocument = JArray.Parse(SourceDocumentJson);
        JObject request = JsonConvert.DeserializeObject<JObject>(singleDocument[0].ToString(), new JsonSerializerSettings()
        {
            FloatFormatHandling = FloatFormatHandling.String,
            FloatParseHandling = FloatParseHandling.Decimal,
            DateFormatHandling = DateFormatHandling.IsoDateFormat,
            DateParseHandling = DateParseHandling.None
        });

        //Start serialize
        String canonicalString = tokenSigner.SerializeJSON(request);

        // retrieve cades
        if (request["documentTypeVersion"].Value<string>() == "0.9")
        {
            cades = "ANY";
        }
        else
        {
            cades = tokenSigner.SignWithCMS(canonicalString);
        }

        JObject signatureObject = JObject.FromObject(new { signatureType = "I", value = cades });
        return signatureObject;
    }
    
    private static byte[] Hash(string input)
    {
        byte[] output = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return output;
    }

    private static byte[] HashBytes(byte[] input)
    {
        byte[] output = SHA256.HashData(input);
        return output;
    }

    public string SignWithCMS(String serializedText)
    {
        byte[] data = Encoding.UTF8.GetBytes(serializedText);
        Pkcs11InteropFactories factories = new();
        using IPkcs11Library pkcs11Library = factories.Pkcs11LibraryFactory.LoadPkcs11Library(factories, DllLibPath, AppType.MultiThreaded);
        ISlot slot = pkcs11Library.GetSlotList(SlotsType.WithTokenPresent).FirstOrDefault();

        if (slot is null)
        {
            return "No slots found";
        }

        ITokenInfo tokenInfo = slot.GetTokenInfo();

        ISlotInfo slotInfo = slot.GetSlotInfo();

        using var session = slot.OpenSession(SessionType.ReadWrite);
        session.Login(CKU.CKU_USER, Encoding.UTF8.GetBytes(TokenPin));

        var certificateSearchAttributes = new List<IObjectAttribute>() {
            session.Factories.ObjectAttributeFactory.Create(CKA.CKA_CLASS, CKO.CKO_CERTIFICATE),
            session.Factories.ObjectAttributeFactory.Create(CKA.CKA_TOKEN, true),
            session.Factories.ObjectAttributeFactory.Create(CKA.CKA_CERTIFICATE_TYPE, CKC.CKC_X_509)
        };

        IObjectHandle certificate = session.FindAllObjects(certificateSearchAttributes).FirstOrDefault();

        // if (certificate is null)
        // {
        //     return "Certificate not found";
        // }

        X509Store store = new(StoreName.My, StoreLocation.CurrentUser);
        store.Open(OpenFlags.MaxAllowed);

        // find cert by thumbprint
        var foundCerts = store.Certificates.Find(X509FindType.FindByThumbprint, TokenCertificate, false);
        if (foundCerts.Count == 0)
        {
            return "no device detected";
        }

        var certForSigning = foundCerts[0];
        store.Close();

        ContentInfo content = new(new Oid("1.2.840.113549.1.7.5"), data);
        SignedCms cms = new(content, true);

        EssCertIDv2 bouncyCertificate = new(
            new Org.BouncyCastle.Asn1.X509.AlgorithmIdentifier(new DerObjectIdentifier("1.2.840.113549.1.9.16.2.47")),
            HashBytes(certForSigning.RawData)
        );

        SigningCertificateV2 signerCertificateV2 = new([bouncyCertificate]);
        CmsSigner signer = new(certForSigning)
        {
            DigestAlgorithm = new Oid("2.16.840.1.101.3.4.2.1")
        };

        signer.SignedAttributes.Add(new Pkcs9SigningTime(DateTime.UtcNow));
        signer.SignedAttributes.Add(new AsnEncodedData(new Oid("1.2.840.113549.1.9.16.2.47"), signerCertificateV2.GetEncoded()));
        cms.ComputeSignature(signer);
        var output = cms.Encode();

        return Convert.ToBase64String(output);
    }

    public string SerializeJSON(JObject request)
    {
        return SerializeJSONToken(request);
    }

    private string SerializeJSONToken(JToken request)
    {
        string serialized = "";
        if (request.Parent is null)
        {
            SerializeJSONToken(request.First);
        }
        else
        {
            if (request.Type == JTokenType.Property)
            {
                string name = ((JProperty)request).Name.ToUpper();
                serialized += "\"" + name + "\"";
                foreach (var property in request)
                {
                    if (property.Type == JTokenType.Object)
                    {
                        serialized += SerializeJSONToken(property);
                    }
                    if (property.Type == JTokenType.Boolean || property.Type == JTokenType.Integer || property.Type == JTokenType.Float || property.Type == JTokenType.Date)
                    {
                        serialized += "\"" + property.Value<string>() + "\"";
                    }
                    if(property.Type == JTokenType.String)
                    {
                        serialized +=  JsonConvert.ToString(property.Value<string>()) ;
                    }
                    if (property.Type == JTokenType.Null)
                    {
                        serialized += "\"null\"";
                    }
                    if (property.Type == JTokenType.Array)
                    {
                        foreach (var item in property.Children())
                        {
                            serialized += "\"" + ((JProperty)request).Name.ToUpper() + "\"";
                            serialized += SerializeJSONToken(item);
                        }
                    }
                }
            }
            // Added to fix "References"
            if (request.Type == JTokenType.String)
            {
                serialized += JsonConvert.ToString(request.Value<string>());
            }

            if (request.Type == JTokenType.Null)
            {
                serialized += "\"null\"";
            }
        }
        if (request.Type == JTokenType.Object)
        {
            foreach (var property in request.Children())
            {

                if (property.Type == JTokenType.Object || property.Type == JTokenType.Property)
                {
                    serialized += SerializeJSONToken(property);
                }
            }
        }

        return serialized;
    }

    public static List<CertificateInfo> ListCertificates()
    {
        var certificates = new List<CertificateInfo>();

        X509Store store = new(StoreName.My, StoreLocation.CurrentUser);
        store.Open(OpenFlags.MaxAllowed);
        X509Certificate2Collection collection = (X509Certificate2Collection)store.Certificates;
        foreach (X509Certificate2 cert in collection)
        {
            try
            {
                certificates.Add(new CertificateInfo
                {
                    FriendlyName = cert.FriendlyName,
                    IssuedBy = cert.GetNameInfo(X509NameType.SimpleName, true),
                    IssuedTo = cert.GetNameInfo(X509NameType.SimpleName, false),
                    SignatureAlgorithm = cert.SignatureAlgorithm.FriendlyName ?? "",
                    SerialNumber = cert.SerialNumber,
                    ContentType = X509Certificate2.GetCertContentType(cert.RawData).ToString(),
                    IsVerified = cert.Verify(),
                    ExpirationDate = cert.GetExpirationDateString(),
                    Archived = cert.Archived,
                    RawDataLength = cert.RawData.Length,
                    CertThumprint = cert.Thumbprint ?? "",
                    HasPrivateKey = cert.HasPrivateKey
                });

                cert.Reset();
            }
            catch (CryptographicException)
            {
                Console.WriteLine("Information could not be written out for this certificate.");
            }
        }
        store.Close();
        return certificates;
    }
}