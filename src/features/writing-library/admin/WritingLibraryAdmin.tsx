import GenericExamModuleAdmin from '../../exam-platform/admin/GenericExamAdmin';

export default function WritingLibraryAdmin({ token }: { token: string }) {
  return (
    <section id="writing-library-admin" data-writing-library>
      <GenericExamModuleAdmin token={token} moduleId="writing" paperId="writing" />
    </section>
  );
}
