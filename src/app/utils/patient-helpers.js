/* ── Helper: IST timestamp ── */
export const getISTNow = () => {
  const now = new Date();
  const ist = new Date(now.getTime() + 330 * 60 * 1000);
  return ist.toISOString().slice(0, 16);
};

export const getEmptyForm = () => ({
  name: "",
  dob: "",
  age: "",
  gender: "",
  genderIdentity: "",
  phone: "",
  address: "",
  uhId: "",
  collectionTime: "",
  receivedTime: "", // Consistently empty for SSR
  refDoctorName: "",
  reportType: "Hand",
  barcode: "",
  selectedTests: [],
});

export const calculateAge = (dobString) => {
  if (!dobString) return "";
  const birthDate = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age < 0 ? 0 : age;
};

export const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (!parts[0]) return "?";
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : parts[0][0].toUpperCase();
};

export const formatDate = (d) => {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};
