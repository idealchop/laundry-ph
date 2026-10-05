import { Placeholder } from "@/components/Placeholder";

export const metadata = { title: "Shop listing" };

export default function Page() {
  return (
    <Placeholder
      title="Shop listing"
      description="What River Mobile customers see."
      icon="washer"
      phase="Phase 2"
      backHref="/partner"
      planned={[
        "Shop profile, hours and photos",
        "Services and kilo prices listed on River Mobile",
      ]}
    />
  );
}
