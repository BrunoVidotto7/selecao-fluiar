package br.com.fluiar.selecao.exception;

public final class ErrorMessages {
    public static final String CLIENT_CHANGE_REVISION_INVALID = "A revisão informada não está disponível nesta lista.";
    public static final String CLIENT_CHANGE_PAGE_INVALID = "Informe uma página inteira não negativa.";

    public static final String PRODUCT_COLLECTION_FAILED = "Não foi possível consultar este produto. Confira o endereço e tente novamente.";

    public static final String PRODUCT_STORE_SYNC_MISMATCH = "Busque o produto novamente e confirme nome, preço e foto antes de vincular à loja.";

    public static final String AUTHENTICATION_REQUIRED = "Entre na sua conta para continuar.";
    public static final String ACCESS_DENIED = "Você não tem permissão para acessar este recurso.";
    public static final String CLIENT_ALREADY_ACTIVE = "Este perfil já tem acesso ativo.";
    public static final String INVITATION_EMAIL_IN_USE = "Este e-mail já tem um convite para outro perfil.";
    public static final String VALIDATION_FAILED = "Revise os campos destacados.";
    public static final String INVALID_REQUEST = "Revise os dados enviados.";
    public static final String NOT_FOUND = "Não encontramos o que você procurava.";
    public static final String INVALID_CREDENTIALS = "E-mail ou senha incorretos.";
    public static final String EMAIL_IN_USE = "Este e-mail já tem uma conta.";
    public static final String PASSWORD_SIZE = "Use entre 8 e 72 caracteres.";
    public static final String PASSWORD_TOO_LONG =
            "Senha longa demais: letras com acento e emojis ocupam mais de um caractere.";
    public static final String DUPLICATE_RECORD = "Este registro já existe.";
    public static final String WRONG_CURRENT_PASSWORD = "Senha atual incorreta.";
    public static final String CURRENT_PASSWORD_REQUIRED_FOR_EMAIL = "Informe a senha atual para trocar o e-mail.";
    public static final String TOO_MANY_ATTEMPTS = "Muitas tentativas. Tente novamente em alguns minutos.";
    public static final String INVALID_LINK = "Este link expirou ou já foi usado. Peça um novo.";
    public static final String EMAIL_NOT_SENT =
            "Não conseguimos enviar o e-mail agora. Tente novamente em alguns minutos.";
    public static final String PHONE_INVALID = "Digite o telefone com DDD, como (31) 99999-9999.";
    public static final String LIST_CLIENT_REQUIRED = "Escolha o perfil principal desta lista.";
    public static final String ZIP_CODE_INVALID = "Digite o CEP com 8 números, como 30140-071.";
    public static final String TAX_DOCUMENT_INVALID = "Digite um CPF ou CNPJ válido.";
    public static final String CPF_INVALID = "Digite um CPF válido.";
    public static final String BIRTH_DATE_INVALID = "Digite uma data de nascimento válida, como 25/03/1985.";
    public static final String LIST_MEMBER_DUPLICATED = "Cada perfil pode aparecer só uma vez.";
    public static final String LIST_MEMBER_NOT_IN_OFFICE = "Escolha um perfil do escritório.";
    public static final String LIST_READ_ONLY = "Você só pode visualizar esta lista.";
    public static final String ROOM_NAME_IN_USE = "Já existe um ambiente com esse nome nesta lista.";
    public static final String ROOM_ORDER_INCOMPLETE = "Envie todos os ambientes da lista, sem repetir.";
    public static final String ROOM_REQUIRED = "Escolha o ambiente do produto.";
    public static final String CATEGORY_REQUIRED = "Escolha uma categoria.";
    public static final String CATEGORY_NAME_REQUIRED = "Informe o nome da categoria.";
    public static final String CATEGORY_NAME_TOO_LONG = "Use até 60 caracteres.";
    public static final String CATEGORY_NAME_IN_USE = "Já existe uma categoria com esse nome.";
    public static final String CATEGORY_NOT_IN_OFFICE = "Escolha uma categoria do escritório.";
    public static final String ROOM_NOT_IN_LIST = "Escolha um ambiente desta lista.";
    public static final String QUANTITY_UNIT_INVALID = "Use um número inteiro de 1 a 999.";
    public static final String QUANTITY_AREA_INVALID = "Use um valor de 0,01 a 999,99, com até 2 casas decimais.";
    public static final String LINK_URL_INVALID = "Cole o link completo, começando com https://";
    public static final String LINKS_TOO_MANY = "Adicione no máximo 10 links.";
    public static final String INVALID_IMAGE = "Escolha um arquivo de imagem (JPG ou PNG).";
    public static final String IMAGE_TOO_LARGE = "A imagem deve ter até 5 MB.";
    public static final String FILE_NOT_READ = "Não conseguimos ler o arquivo. Tente enviar de novo.";
    public static final String UNEXPECTED_ERROR = "Algo deu errado do nosso lado. Tente novamente em alguns minutos.";

    private ErrorMessages() {
    }
}
