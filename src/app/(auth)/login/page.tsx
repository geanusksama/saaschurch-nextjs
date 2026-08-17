import { redirect } from "next/navigation";

/**
 * `/login` é um endereço herdado: aqui existia uma SEGUNDA tela de login, em
 * página Next, enquanto o login de verdade é o do SPA, em `/auth/login` — para
 * onde apontam todos os links do sistema e o redirect de sessão expirada
 * (`AppSPA`).
 *
 * Duas telas fazendo login davam divergência real: esta ficou para trás, com
 * links para `/forgot-password` e `/register`, que nem existiam como página
 * Next e caíam no catch-all do SPA.
 *
 * A rota continua existindo, só que como redirecionamento: quem tem o endereço
 * salvo nos favoritos cai no login certo em vez de tomar 404.
 */
export default function LoginRedirect() {
  redirect("/auth/login");
}
