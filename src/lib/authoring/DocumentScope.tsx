import { createContext, useContext } from 'react';
export const AuthoringDocumentScope = createContext('standalone');
export const useDocumentScope = () => useContext(AuthoringDocumentScope);
export const AuthoringOwner = createContext('');
