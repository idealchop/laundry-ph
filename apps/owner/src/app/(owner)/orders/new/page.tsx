import { FocusSurface } from "@/components/FocusHeader";
import { PosForm } from "@/components/pos/PosForm";
import { data } from "@/data";

export const metadata = { title: "New walk-in order" };

export default async function NewOrderPage() {
  const catalog = await data.getCatalog();
  return (
    <FocusSurface>
      <PosForm catalog={catalog} />
    </FocusSurface>
  );
}
