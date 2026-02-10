import { SkillDetail } from "@/app/app-components/features/skills/skill-form";

interface PageProps {
  params: Promise<{ skillId: string }>;
}

const SkillDetailPage = async ({ params }: PageProps) => {
  const { skillId } = await params;

  return (
    <div className="p-4 md:px-10 md:py-6 h-full">
      <div className="mx-auto max-w-screen-md w-full flex flex-col gap-y-8 h-full">
        <SkillDetail skillId={skillId} />
      </div>
    </div>
  );
};

export default SkillDetailPage;
