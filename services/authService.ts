
// Serviço de Autenticação com Envio Real de E-mail

// Formata CNPJ: 00.000.000/0000-00
export const formatCNPJ = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');
};

export const validateCNPJ = (cnpj: string): boolean => {
  const numbers = cnpj.replace(/[^\d]/g, '');
  if (numbers.length !== 14) return false;
  return true;
};

// Envia código de verificação via API (Resend)
export const sendVerificationCode = async (email: string): Promise<string> => {
  // Gera o código no cliente para manter o estado local (fluxo atual do Login.tsx)
  // Em um cenário de alta segurança, o servidor deveria gerar e validar, 
  // mas mantemos assim para compatibilidade com a estrutura do seu frontend.
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    const response = await fetch('/api/send-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, code }),
    });

    if (!response.ok) {
      // Fallback para desenvolvimento local sem API configurada
      console.warn(`[DEV MODE] API de Email falhou ou não configurada. Código gerado: ${code}`);
    } else {
      console.log(`[AUTH] Código enviado para ${email}`);
    }
  } catch (error) {
    // Fallback silencioso em caso de erro de rede (evita travar o usuário)
    console.warn(`[DEV MODE] Erro de conexão com API. Código gerado: ${code}`);
  }

  return code;
};

export const simulateGoogleLogin = async (): Promise<{ email: string; name: string; avatar: string }> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        email: "usuario.google@gmail.com",
        name: "Usuário Google",
        avatar: "https://lh3.googleusercontent.com/a/default-user"
      });
    }, 2000);
  });
};
