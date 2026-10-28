import LogOutButton from "./LogOutButton";

const AccessDeniedBanner = () => {
    return (
        <div
            dir="rtl"
            className="font-arabic space-y-4"
        >
            <h2 className="text-destructive text-xl font-semibold">
                تم رفض الدخول
            </h2>
            <div className="space-y-2">
                <p>
                    حسابك لا يملك الصلاحية للوصول إلى بوابة إرسال الفواتير لمصلحة الضرائب المصرية.
                </p>
                <p>
                    يسمح فقط لموظفي الإدارة المالية المصرح لهم بتوقيع وإرسال الفواتير.
                </p>
            </div>
            <LogOutButton/>
        </div>
    );
};

export default AccessDeniedBanner;