export interface ClassActor {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'teacher' | 'student';
}

export function classHttpError(status: number, message: string) {
  const error: any = new Error(message);
  error.status = status;
  return error;
}
