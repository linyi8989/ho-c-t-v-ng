export interface AssignmentActor {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'teacher' | 'student';
}

export type AssignmentResourceType = 'vocabulary' | 'listening' | 'mover_reading_writing' | 'exam';

export function assignmentHttpError(status: number, message: string) {
  const error: any = new Error(message);
  error.status = status;
  return error;
}
