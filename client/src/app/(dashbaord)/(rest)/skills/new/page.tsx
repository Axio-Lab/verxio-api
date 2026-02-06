import { SkillForm } from "@/app/app-components/features/skills/skill-form";

const NewSkillPage = () => {
  return (
    <div className="p-4 md:px-10 md:py-6 h-full">
      <div className="mx-auto max-w-screen-md w-full flex flex-col gap-y-8 h-full">
        <SkillForm />
      </div>
    </div>
  );
};

export default NewSkillPage;
