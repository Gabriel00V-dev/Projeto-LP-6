/** CPF/CNPJ são guardados só com dígitos; a máscara é coisa da tela. */
export function somenteDigitos(valor?: string | null): string {
  return (valor ?? '').replace(/\D/g, '');
}

export function cpfValido(valor?: string | null): boolean {
  const d = somenteDigitos(valor);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;

  const digito = (tamanho: number) => {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(d[i]) * (tamanho + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
}

export function cnpjValido(valor?: string | null): boolean {
  const d = somenteDigitos(valor);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;

  const digito = (pesos: number[]) => {
    const soma = pesos.reduce((total, peso, i) => total + Number(d[i]) * peso, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  return (
    digito([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[12]) &&
    digito([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[13])
  );
}

export function emailValido(valor?: string | null): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor ?? '');
}
