import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export function OAuthHandler() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    const userParam = searchParams.get("user");

    if (token && userParam) {
      try {
        const user = JSON.parse(decodeURIComponent(userParam));
        localStorage.setItem("auth_token", token);
        localStorage.setItem("user", JSON.stringify(user));

        // Redirect based on user role
        if (user.role === "admin") {
          navigate("/admin");
        } else {
          navigate("/app");
        }
      } catch (error) {
        console.error("OAuth handler error:", error);
        navigate("/login?error=oauth_failed");
      }
    }
  }, [searchParams, navigate]);

  return null; // This component doesn't render anything
}
