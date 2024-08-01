'use server';

import { signIn } from '@/auth';
import { sql } from '@vercel/postgres';
import { AuthError } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod'
const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({message: 'Please select a customer.'}),
    amount: z.coerce.number().gt(0,{message: 'Please enter an amount grather than $0.'}),
    status: z.enum(['pending', 'paid'],{message: 'Please select an invoice status.'}),
    date: z.string(),
});

const CreateInvoice = FormSchema.omit({id: true, date: true})
const UpdateInvoice = FormSchema.omit({id: true, date: true})
export type State = {
    errors?: {
        customerId?: string[];
        amount?: string[];
        status?: string[];
    };
    message?: string | null;
};

export async function createInvoice(prevState: State,formData:FormData) {
    const rawFormData = {
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status')
    }
    const validateFields = CreateInvoice.safeParse(rawFormData);
    console.log(validateFields)
    if(!validateFields.success){
        return {
            errors: validateFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Faield to Create Invoice'
        }
    }
    const { customerId, amount, status } = validateFields.data;
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];

    try {
        await sql `
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
        `;
    } catch (error) {
        return { message: 'Database Error: Failed to Create Invoice.',}
    }
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices')
    // console.log(rawFormData)
}




export async function updateInvoice(id:string, prevState: State, formData:FormData) {

    const validateFields = UpdateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
      });
      if(!validateFields.success){
        return {
            errors: validateFields.error.flatten().fieldErrors,
            message: "Missing Fields. Failed to Update Invoice."
        }
      }
      const { customerId, amount, status } = validateFields.data
      const amountInCents = amount * 100;
      try {
        await sql `
        UPDATE invoices
        SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}
        `
      } catch (error) {
        return { message: 'Database Error: Failed to Update Invoice.' };
      }
      revalidatePath('/dashboard/invoices')
      redirect('/dashboard/invoices')
}



export async function deleteInvoice(id:string) {
    // throw new Error("can not delete");
    
    try{
        await sql `DELETE FROM invoices WHERE id = ${id}`
        revalidatePath('/dashboard/invoices')
    }catch(error){
        return { message: 'Database Error: Failed to Delete Invoice.' };
    }
}

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
){
    try{
        await signIn('credentials',formData)
    }catch(error){
        if(error instanceof AuthError){
            switch (error.type) {
                case 'CredentialsSignin':
                    return 'Invalid credentials.'            
                default:
                    return 'Something went wrong.'
            }
        }
        throw error;
        }
}