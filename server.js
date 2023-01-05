const express = require("express")
const {Server: HTTPServer} = require("http")
const {Server: IOServer} = require("socket.io");
const {faker} = require("@faker-js/faker");
const  {mongoose}  = require("mongoose");
const handlebars = require('express-handlebars');
const {normalizr, normalize, schema, denormalize} = require("normalizr");

const app = express()
const httpServer = new HTTPServer(app)
const io = new IOServer(httpServer)


app.use(express.urlencoded({extended: true}))
app.use(express.json())

//PERSISTENCIA PRODUCTOS
const {optionsSQL} = require("./options/mysql.js");
const Contenedor = require('./clase-contenedor.js');
const arrayProductos = new Contenedor(optionsSQL, "productos");

app.use(express.static('views'));

//*HANDLEBARS
app.set('views', './views/')


 const hbs = handlebars.engine({
   extname: "hbs",
   layoutsDir: "./views/layouts/",
 });
 app.engine("hbs", hbs);
 app.set("view engine", "hbs")



//productos-test
let listaProductos = [];
function crearProductosRandom(){
    for(let i=0; i<5; i++){
        listaProductos.push( 
            {
                title: faker.commerce.product().toString(),
                price: faker.commerce.price(100, 200, 0, '$').toString(),
                thumbnail: faker.image.imageUrl(100, 100).toString()
            } 
        )
    }
    return listaProductos;
}

// PERSISTENCIA MENSAJES
const ContenedorFS =  require('./contenedor-fs.js');
const mensajesFS = new ContenedorFS('./mensajes.json')

const ContenedorMongoDB = require("./ContenedorMongoDB.js");
const Schema = mongoose.Schema;
 const model = mongoose.model;

const mensajeSchemaMongo = new Schema({
    author:{
        email: { type: String, required: true, max:100 },
        nombre:  { type: String, required: true, max: 100 },
        apellido: { type: String, required: true, max: 100 },
        edad:  { type: String, required: true, max: 3 },
        alias: { type: String, required: true, max: 100 },
        avatar:  { type: String, required: true, max: 1000 },
        fecha:  { type: String, required: true, max: 1000 },
    },    
    text:{type: String, required:true, max: 1000 }
    
});
const modeloMensajes = model('modeloMensajes', mensajeSchemaMongo);
const rutaMensajes = 'mongodb://127.0.0.1:27017/Mensajes-Mongo-DB';
const baseMongo = 'Mensajes-Mongo-DB';
const coleccionMensajes = 'mensajes';
const Mensajes = new ContenedorMongoDB(rutaMensajes, modeloMensajes, baseMongo, coleccionMensajes );
async function conectarMongo(){
    await Mensajes.connectMG().then(()=> console.log("MongoDB conectado"))
} 




//RUTAS

app.get('/', async (req, res)=>{
    try{
        const listaProductos = await arrayProductos.getAll();
        if(listaProductos){
            res.render("main", { layout: "vista-productos", productos: listaProductos });
        }else{
            res.render("main", {layout: "error"})
        }
    }
    catch(err){
        console.log(err)
    }
})

app.get('/api/productos-test', async (req, res)=>{
    res.render("main", { layout: "productos-test"})
})



//NORMALIZACION
function normlizarChat(data){
            //esquemas para normalizacion
            const emailSchema = new schema.Entity('emails');

        const textSchema = new schema.Entity('text');
        const authorSchema = new schema.Entity('authors', {idAttribute: emailSchema })
    
          const mensajeSchema = new schema.Entity('mensajes', 
            {author:authorSchema,
            text:textSchema,
            idAttribute:"id"}
          );

            

 const dataMap = data.map((item)=>({
    author:item.author,
    text: item.text,
    _id: item["_id"]
 }))
 const dataNormalizada = normalize(dataMap,mensajeSchema)
 return dataNormalizada
}

//*WEBSOCKET PRODUCTOS Y MENSAJES
//'1) conexión del lado del servidor
io.on('connection', async (socket) =>{
    console.log(`io socket conectado ${socket.id}`);

        
        //conectarMongo()
        //const listaMensajes = await Mensajes.listarTodos();
        

        const listaMensajes = await mensajesFS.getAll();
        
        const normalizado = normlizarChat(listaMensajes)
        console.log("normalizado", JSON.stringify(normalizado, null, 4));
        //const desnormalizado = denormalize(normalizado.result, TodosLosMensajesSchema, normalizado.entities);
        //console.log("desnormalizado", desnormalizado);
        socket.emit("mensajes", listaMensajes)

        socket.emit("productos", await arrayProductos.getAll())
        socket.emit("prod-test", crearProductosRandom())

                //' 3) escuchar un cliente (un objeto de producto)
                socket.on('new_prod', async (data) =>{
                    await arrayProductos.save(data)
                    const listaActualizada = await arrayProductos.getAll();
                    //' 4) y propagarlo a todos los clientes: enviar mensaje a todos los usuarios conectados: todos pueden ver la tabla actualizada en tiempo real
                    io.sockets.emit('productos', listaActualizada)
                })                
                socket.on('new_msg', async (data)=>{
                    //await Mensajes.guardar(data);
                    //const listaMensajes = await Mensajes.listarTodos();
                    await mensajesFS.save(data);
                    const listaMensajes = await mensajesFS.getAll();
                   
                    
                    io.sockets.emit('mensajes', listaMensajes)
            
                })
                
                
                
        })

        httpServer.listen(8080, ()=>{
            console.log('servidor de express iniciado')
        
        })