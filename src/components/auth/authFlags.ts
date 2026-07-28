/**
 * Cadastro público de contas.
 *
 * Desligado: o painel é área restrita à liderança, e quem entrava por aqui
 * criava uma conta `pending` que alguém tinha de ativar na mão. Usuários passam
 * a ser criados só pela tela de Usuários, por quem já tem acesso.
 *
 * ATENÇÃO — isto trava a aplicação, não o Supabase. O `supabase.auth.signUp`
 * é chamado direto do navegador, então quem souber a chave anônima ainda
 * consegue criar conta por fora. Para fechar de verdade é preciso desligar
 * "Allow new users to sign up" no painel do Supabase
 * (Authentication → Sign In / Providers → Email).
 */
export const CADASTRO_PUBLICO_HABILITADO = false;
