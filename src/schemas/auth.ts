/**
 * Schemas Zod pra validação de formulários de autenticação.
 *
 * Uso: `loginSchema.safeParse(formData)` retorna { success, data | error }.
 */
import { z } from 'zod';

// Regex de email RFC 5322 simplificado — mais permissivo que o default do Zod
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email é obrigatório')
  .max(254, 'Email muito longo')
  .regex(EMAIL_REGEX, 'Formato de email inválido')
  .toLowerCase();

export const passwordSchema = z
  .string()
  .min(8, 'Senha precisa de pelo menos 8 caracteres')
  .max(128, 'Senha muito longa')
  .refine((p) => /[A-Z]/.test(p), 'Inclua pelo menos uma letra maiúscula')
  .refine((p) => /[a-z]/.test(p), 'Inclua pelo menos uma letra minúscula')
  .refine((p) => /\d/.test(p), 'Inclua pelo menos um número');

// Login: senha menos restritiva (já existe no banco)
export const loginPasswordSchema = z
  .string()
  .min(1, 'Senha é obrigatória')
  .max(128, 'Senha muito longa');

export const loginSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema,
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Nome muito curto')
      .max(80, 'Nome muito longo')
      .refine((n) => !/[<>{}[\]\\]/.test(n), 'Nome contém caracteres inválidos'),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.boolean().refine((v) => v === true, 'Você precisa aceitar os termos'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Senhas não coincidem',
    path: ['confirmPassword'],
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const resetPasswordRequestSchema = z.object({
  email: emailSchema,
});
export type ResetPasswordRequestInput = z.infer<typeof resetPasswordRequestSchema>;

export const resetPasswordConfirmSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Senhas não coincidem',
    path: ['confirmPassword'],
  });
export type ResetPasswordConfirmInput = z.infer<typeof resetPasswordConfirmSchema>;

/**
 * Helper que converte ZodError em map { campo → mensagem }.
 */
export function zodErrorToFieldMap(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.');
    if (path && !fieldErrors[path]) {
      fieldErrors[path] = issue.message;
    }
  }
  return fieldErrors;
}
