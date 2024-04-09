import { Hocuspocus } from "@hocuspocus/server";


const server = new Hocuspocus({
    port: 3033,
    // quiet: true,
});


server.listen();