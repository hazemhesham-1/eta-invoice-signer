import UpdateNotification from "./UpdateNotification";

const Footer = () => {
    return (
        <footer className="w-full space-y-2 px-6 py-5 mt-auto">
            <UpdateNotification/>
            <div className="text-muted-foreground flex flex-col items-center justify-between gap-4 max-w-7xl mx-auto text-sm sm:flex-row">
                <p className="m-0">
                    &copy; 2026 IWOMT. All rights reserved.
                </p>
                <div className="flex items-center gap-1.5">
                    <span>Developed by</span>
                    <a
                        href="https://hazem-dev.vercel.app/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground inline-flex items-center gap-1 font-medium transition-colors duration-200 group hover:text-primary"
                    >
                        Hazem Hesham
                    </a>
                </div>
            </div>
        </footer>
    );
};

export default Footer;