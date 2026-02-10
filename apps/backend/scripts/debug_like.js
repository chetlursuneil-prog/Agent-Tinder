const axios = require('axios');
const API = 'http://localhost:3001';
(async()=>{
  try{
    const uA=(await axios.post(API+'/auth/signup',{email:'testA'+Date.now()+'@x.com',name:'A'})).data;
    const uB=(await axios.post(API+'/auth/signup',{email:'testB'+Date.now()+'@x.com',name:'B'})).data;
    const pA=(await axios.post(API+'/profiles',{userId:uA.id,skills:[],about:'a'})).data;
    const pB=(await axios.post(API+'/profiles',{userId:uB.id,skills:[],about:'b'})).data;
    console.log('pA',pA.id,'pB',pB.id);
    const r1=await axios.post(API+'/matches',{a:pA.id,b:pB.id});
    console.log('first',r1.status,r1.data);
    const r2=await axios.post(API+'/matches',{a:pA.id,b:pB.id});
    console.log('second',r2.status,r2.data);
    const likes=(await axios.get(API+`/likes/from/${pA.id}`)).data;
    console.log('outgoing likes',likes.length, likes.map(l=>l.id));
  }catch(e){ console.error(e.response?e.response.data:e.message);} 
  process.exit(0);
})();
