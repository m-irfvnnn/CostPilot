import { auth } from '@/lib/firebase'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, RecaptchaVerifier, signInWithPhoneNumber, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'

export async function registerWithEmail(email:string,password:string){return await createUserWithEmailAndPassword(auth,email,password)}
export async function loginWithEmail(email:string,password:string){return await signInWithEmailAndPassword(auth,email,password)}
export async function loginWithGoogle(){const provider=new GoogleAuthProvider();return await signInWithPopup(auth,provider)}
export async function logout(){return await signOut(auth)}
