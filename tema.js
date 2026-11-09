// Antes de pintar: el tema elegido y si hay datos guardados (clase con-datos). Es un archivo aparte porque la CSP no permite scripts en línea.
try{var t=localStorage.getItem("cursada.tema");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t;if(localStorage.getItem("cursada.v1"))document.documentElement.classList.add("con-datos")}catch(e){}
