const puppeteer = require('puppeteer');
const cookiesFilePath="cookies.json"
const fs = require("fs"); 
if(!fs.existsSync("config/default.json")){
  defaultConfig={
    "browserExecutablePath":"./browser/chrome-win/chrome.exe",
    "randomDelay":5000,
    "searchDelay":5000,
    "searchPageDelay":20000,
    "accountDelay":60000,
    "updateCookies":true,
    "maxPcSearches":35,
    "maxMobileSearches":45,
    "doDailySet":false,
    "stopOnMaxEarned":true,
    "pcUserAgent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36 Edge/18.18363",
    "mobileUserAgent":"Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) CriOS/54.0.2840.66 Mobile/16A366 Safari/602.1",
    "accounts":[
        "fake_account"
    ],
    "proxys":[]
  }
  fs.writeFileSync("config/default.json",JSON.stringify(defaultConfig,null,2))
}

const config = require('config');
// const pathToMicrosoftRewards= require('path').join(__dirname, 'microsoftRewards/1.5_0');
require('./helper.js')(config,fs);

const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
})

var searches=[]

async function doSearches(browser,deviceType,account,proxy){
  var pages = await browser.pages();
  var mainPage=pages[0]
  if(deviceType==0){
    await mainPage.setUserAgent(config.get("pcUserAgent"))
  }else{
    await mainPage.setUserAgent(config.get("mobileUserAgent"))
  }
  try{
    await loadCookies("bing",account,mainPage,true)
    try{
      await mainPage.goto("https://www.bing.com/?setmkt=en-us&setlang=en-us", { waitUntil: 'load', timeout: 0 });
    }catch(e){
      console.log("Error Loading Page: "+e)
    }
  }catch(e){
    console.log("Error Load Cookies For "+account)
    try{
      await mainPage.goto("https://www.bing.com/?setmkt=en-us&setlang=en-us", { waitUntil: 'load', timeout: 0 });
    }catch(e){
      console.log("Error Loading Page: "+e)
    }
    await new Promise(async(resolve, reject) => {
      readline.question("\n\nlogin to the Bing and press enter here when done:",async function(){
        return resolve(true);  
      })
    })
    try{
      await mainPage.goto("https://www.bing.com/?setmkt=en-us&setlang=en-us", { waitUntil: 'load', timeout: 0 });
    }catch(e){
      console.log("Error Loading Page: "+e)
    }
    await saveCookies("bing",account,mainPage)
  }
  var maxSearches=0
  if(deviceType==0){
    maxSearches=config.get("maxPcSearches")
  }else{
    maxSearches=config.get("maxMobileSearches")
  }
  var startingSearchNum=Math.max(parseInt(Math.random()*(searches.length-maxSearches)),0)
  var bal
  for(var x=0;x<maxSearches;x++){
    if(x>=searches.length){
      console.log("search list to short: stopping")
      break
    }
    bal=await getBalance(browser,account)
    var sleepTime=Math.random()*config.get('randomDelay')+config.get('searchPageDelay')
    if(deviceType==0&&config.get('stopOnMaxEarned')&&parseInt(bal.earnedPcSearch.split('/')[0])==parseInt(bal.earnedPcSearch.split('/')[1])){
      console.log("Earned Today: "+bal.earnedPcSearch)
      break
    }
    if(deviceType==1&&config.get('stopOnMaxEarned')&&parseInt(bal.earnedMobileSearch.split('/')[0])==parseInt(bal.earnedMobileSearch.split('/')[1])){
      console.log("Earned Today: "+bal.earnedMobileSearch)
      break
    }
    await search(searches[startingSearchNum+x],mainPage)
    console.log("Waiting "+parseInt(sleepTime/1000)+" Seconds for next search, todays earnings: "+(deviceType==0?bal.earnedPcSearch:bal.earnedMobileSearch))
    await sleep(sleepTime)
  }
  if(config.get("updateCookies")){
    try{
      await mainPage.goto("https://www.bing.com/?setmkt=en-us&setlang=en-us", { waitUntil: 'load', timeout: 0 });
      await saveCookies("bing",account,mainPage)
    }catch(e){
        console.log("Error updating Cookies: "+e)
        return
    }
  }
  if(!bal){
    bal=await getBalance(browser,account)
  }
  return bal
}

async function doDailySet(browser,account,proxy){
  var pages = await browser.pages();
  var mainPage=pages[0]
  await mainPage.setUserAgent(config.get("pcUserAgent"))
  try{
    await loadCookies("microsoft",account,mainPage,true)
  }catch(e){
    console.log("Error Load Cookies For Microsoft_"+account)
    try{
      await mainPage.goto("https://account.microsoft.com/rewards/?setmkt=en-us&setlang=en-us", { waitUntil: 'load', timeout: 0 });
    }catch(e){
      console.log("Error Loading Page: "+e)
    }
    await new Promise(async(resolve, reject) => {
      readline.question("\n\nlogin to the Microsoft and press enter here when done:",async function(){
        return resolve(true);  
      })
    })
    await saveCookies("microsoft",account,mainPage)
  }

  if(config.get("updateCookies")){
    try{
      await mainPage.goto("https://account.microsoft.com/rewards/?setmkt=en-us&setlang=en-us", { waitUntil: 'load', timeout: 0 });
      await saveCookies("microsoft",account,mainPage)
    }catch(e){
        console.log("Error updating Cookies: "+e)
        return
    }
  }
  var dailySet=await getDailySet(mainPage)
  console.log(dailySet)
}

async function run(account,proxy) {
  try{
    var args=[
      '--start-maximized',
    //  '--disable-extensions-except='+pathToMicrosoftRewards,
    //  '--load-extension='+pathToMicrosoftRewards,
      ]
    if(proxy){
      args.push('--proxy-server='+proxy)
      // args.push('--proxy-bypass-list="192.168.*;*.google.*"')
    }
    var browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args:args,
        executablePath: config.get("browserExecutablePath"),
    });
  }catch(e){
      console.log("Browser Failed To Start: "+e)
      return
  }
  var balance=await doSearches(browser,0,account,proxy)
  console.log("PC Searches Done")
  if(balance.earnedMobileSearch.includes('/')){
    console.log("Starting Mobile")
    await doSearches(browser,1,account,proxy)
    console.log("Mobile Searches Done")
  }else{
    console.log("Mobile Not Available")
  }
  if(config.get("doDailySet")){
    console.log("Starting Daily Set")
    await doDailySet(browser,account,proxy)
  }
  console.log("Account "+account+" Done, Closing Browser")
  browser.close()
}
var accountNum=0
async function main(){
  searches=await updateTrendingWords()
  await run(config.get("accounts")[accountNum],config.get("proxys")[accountNum])
  accountNum++
  if(accountNum>=config.get("accounts")){
    console.log("All Accounts Done: Exiting")
    process.exit(0)
  }
  console.log("waiting "+config.get("accountDelay")/1000+" seconds for next account")
  setTimeout(main,config.get("accountDelay"))
}
main()