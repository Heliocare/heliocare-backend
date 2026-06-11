export function isGlp1Medication(drugName: string): boolean {
  const name = drugName.toLowerCase();
  return (
    name.includes("semaglutide") ||
    name.includes("liraglutide") ||
    name.includes("tirzepatide") ||
    name.includes("wegovy") ||
    name.includes("ozempic") ||
    name.includes("mounjaro")
  );
}
