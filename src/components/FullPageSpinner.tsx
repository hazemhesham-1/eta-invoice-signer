import { Spinner } from "./ui/Spinner";

const FullPageSpinner = () => {
    return (
        <div
            dir="rtl"
            className="font-arabic flex flex-col items-center justify-center space-y-4"
        >
            <Spinner className="text-primary size-20"/>
            <p>برجاء الانتظار...</p>
        </div>
    );
};

export default FullPageSpinner;