package br.com.fluiar.selecao.exception;

public final class ErrorMessages {

    public static final String PRODUCT_COLLECTION_FAILED = "Não foi possível consultar este produto. Confira o endereço e tente novamente.";

    public static final String PRODUCT_STORE_SYNC_MISMATCH = "Busque o produto novamente e confirme nome, preço e foto antes de vincular à loja.";

    public static final String AUTHENTICATION_REQUIRED = "Entre na sua conta para continuar.";
    public static final String ACCESS_DENIED = "Você não tem permissão para acessar este recurso.";
    public static final String CLIENT_ALREADY_ACTIVE = "Este cliente já tem acesso ativo.";
    public static final String INVITATION_EMAIL_IN_USE = "Este e-mail já tem um convite para outro cliente.";
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
    public static final String LIST_CLIENT_REQUIRED = "Escolha o cliente desta lista.";
    public static final String ROOM_NAME_IN_USE = "Já existe um ambiente com esse nome nesta lista.";
    public static final String ROOM_ORDER_INCOMPLETE = "Envie todos os ambientes da lista, sem repetir.";
    public static final String ROOM_REQUIRED = "Escolha o ambiente do produto.";
    public static final String ROOM_NOT_IN_LIST = "Escolha um ambiente desta lista.";
    public static final String LINK_URL_INVALID = "Cole o link completo, começando com https://";
    public static final String LINKS_TOO_MANY = "Adicione no máximo 10 links.";
    public static final String INVALID_IMAGE = "Escolha um arquivo de imagem (JPG ou PNG).";
    public static final String IMAGE_TOO_LARGE = "A imagem deve ter até 5 MB.";
    public static final String FILE_NOT_READ = "Não conseguimos ler o arquivo. Tente enviar de novo.";
    public static final String UNEXPECTED_ERROR = "Algo deu errado do nosso lado. Tente novamente em alguns minutos.";

    private ErrorMessages() {
    }
}
