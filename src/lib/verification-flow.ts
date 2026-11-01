export async function finishEmailVerification(
 user:{reload:()=>Promise<void>;emailVerified:boolean}|null,
 signOut:()=>Promise<void>,
 redirect:()=>void,
 errors:{missing:string;unverified:string},
):Promise<void>{
 if(!user)throw new Error(errors.missing);
 await user.reload();
 if(!user.emailVerified)throw new Error(errors.unverified);
 await signOut();
 redirect();
}
