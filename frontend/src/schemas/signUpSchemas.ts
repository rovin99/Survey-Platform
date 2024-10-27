import {z} from 'zod';

export const usernameValidation = z.string().min(2,"Username must be atleast 2 char").max(20,"Username must be atmost 20 char").regex(
    /^[a-zA-Z0-9_]*$/,"Username must contain only letters, numbers and underscore"
)

export const signUpSchema=z.object({
    username: usernameValidation,
    email: z.string().email({message: "Invalid Email"}),
    password: z.string().min(6,{message:"Password must be atleast 6 char"}),
    
})