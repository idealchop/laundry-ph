import { Placeholder } from "@/components/Placeholder";

export const metadata = { title: "Message Automations" };

export default function Page() {
  return (
    <Placeholder
      title="Message Automations"
      description="Default and custom SMS to customers."
      icon="chat"
      phase="Phase 3"
      backHref="/"
      planned={[
        "Default SMS: Confirmation and Thank you",
        "Custom messages from templates",
        "SMS quota per plan",
      ]}
    />
  );
}
