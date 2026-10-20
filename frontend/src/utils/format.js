// "YYYY-MM-DD" -> "19 Feb 2005" (no timezone shifting for plain dates)
export function formatDay(ymd) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export const todayYmd = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const GENDER_LABELS = {
  female: "Female",
  male: "Male",
  other: "Other",
  prefer_not_to_say: "Prefer not to say",
};

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
