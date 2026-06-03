import { exigirGarantias } from "../guard";
import RegistrarGarantiaClientPage from "./client-page";

export default async function RegistrarGarantiaPage() {
  await exigirGarantias();
  return <RegistrarGarantiaClientPage />;
}
