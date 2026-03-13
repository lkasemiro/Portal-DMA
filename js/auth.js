const AUTH_CONFIG = {
  user: "dma.recicla",
  password: "cedae2026"
};

function login(username,password){

  if(
    username === AUTH_CONFIG.user &&
    password === AUTH_CONFIG.password
  ){

    const session = {
      username,
      role:"tecnico",
      loginTime: Date.now()
    };

    localStorage.setItem(
      "dma_session",
      JSON.stringify(session)
    );

    window.location.href = "./recicla-tecnico.html";

  } else {

    const err = document.getElementById("loginError");
    if(err) err.textContent = "Usuário ou senha inválidos";

  }

}

function logout(){

  localStorage.removeItem("dma_session");

  window.location.href = "./login.html";

}

function getSession(){

  const s = localStorage.getItem("dma_session");

  if(!s) return null;

  return JSON.parse(s);

}

function requireAuth(){

  const session = getSession();

  if(!session){

    window.location.href = "./login.html";

  }

}

document
.getElementById("loginBtn")
?.addEventListener("click",()=>{

  const username =
    document.getElementById("username").value;

  const password =
    document.getElementById("password").value;

  login(username,password);

});