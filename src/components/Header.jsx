import companyLogo from "../../assets/logo.png";
import etaLogo from "../../assets/eta-logo.png";

const Header = () => {
    return (
        <header className="flex items-center justify-between p-8 pt-4">
            <div className="flex items-center gap-6">
                <div className="relative h-full w-22">
                    <img
                        src={companyLogo}
                        alt="IWOMT Logo"
                        className="size-full"
                    />
                </div>
                <div className="relative h-full w-18">
                    <img
                        src={etaLogo}
                        alt="Egyptian Tax Authority Logo"
                        className="size-full"
                    />
                </div>
            </div>
            <div className="flex flex-col">
                <h1 className="text-foreground text-xl font-bold">
                    <span className="text-primary">IW<span className="text-[#E32A26]">O</span>MT</span> - ETA Invoice Signer
                </h1>
                <p className="text-muted-foreground text-xs">
                    Egyptian Tax Authority E-Signature Tool
                </p>
            </div>
        </header>
    );
};

export default Header;