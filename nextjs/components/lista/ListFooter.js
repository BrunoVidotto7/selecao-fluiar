// Nota e assinatura do rodapé da lista (texto da página original)
export function ListNote() {
  return (
    <aside className="disc">
      <b>Nota</b>
      <p>As opções desta lista foram selecionadas pela Fluiar com todo cuidado, considerando o projeto, a qualidade e a procedência de cada loja. Ainda assim, como as compras são feitas diretamente com os vendedores, podem ocorrer intercorrências.</p>
      <p>A Fluiar não realiza vendas nem se responsabiliza pelas transações. Se algo acontecer, estamos à disposição para orientar sobre os seus direitos como consumidor junto à loja.</p>
    </aside>
  );
}

export function ListSignature() {
  return (
    <div className="sign">
      <div className="sg">
        <span className="logo">FLUIAR</span>
        <span className="arqs"><span>Arq. Paula Hooper</span><span>Arq. Isabela Machado</span></span>
      </div>
      <span className="ct">olafluiar@gmail.com | @fluiar</span>
    </div>
  );
}
