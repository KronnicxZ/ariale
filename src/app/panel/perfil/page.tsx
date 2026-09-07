import { redirect } from "next/navigation";
import { PageHeader } from "@/components/panel/page-header";
import { getCurrentUser } from "@/lib/auth";
import { ProfileForms } from "./profile-forms";

export const metadata = { title: "Perfil" };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Perfil" description="Tus datos y tu contraseña" />
      <ProfileForms
        user={{
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          // Quién atiende y quién no: Alejandra y Arianny están ligadas a su
          // ficha de especialista, y quien lleva el sistema no.
          esEspecialista: Boolean(user.specialistId),
        }}
      />
    </div>
  );
}
