export function getAuthErrorMessage(error: any, fallback: string) {
  const code = error?.code;

  if (code === 'auth/operation-not-allowed') {
    return 'Phuong thuc dang nhap nay chua duoc bat trong Firebase Authentication. Hay bat Email/Password, Google hoac Phone trong Firebase Console.';
  }

  if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return 'Email hoac mat khau khong chinh xac.';
  }

  if (code === 'auth/email-already-in-use') {
    return 'Dia chi email nay da duoc su dung boi tai khoan khac.';
  }

  if (code === 'auth/invalid-verification-code') {
    return 'Ma xac minh OTP khong chinh xac hoac da het han.';
  }

  if (code === 'auth/unauthorized-domain') {
    return 'Domain hien tai chua duoc them vao Firebase Authentication > Authorized domains.';
  }

  return error?.message || fallback;
}
