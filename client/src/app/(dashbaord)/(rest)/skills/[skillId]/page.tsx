import { SkillDetail } from "@/app/app-components/features/skills/skill-form";

const SkillDetailPage = ({ params }: { params: { skillId: string } }) => {
  return (
    <div className="p-4 md:px-10 md:py-6 h-full">
      <div className="mx-auto max-w-screen-md w-full flex flex-col gap-y-8 h-full">
        <SkillDetail skillId={params.skillId} />
      </div>
    </div>
  );
};

export default SkillDetailPage;
