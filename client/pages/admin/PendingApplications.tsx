// This page is deprecated. All pending application review is now in the dashboard.
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function PendingApplications() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/admin");
  }, [navigate]);
  return null;
}
