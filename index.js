const cookiesFilePath="cookies.json"
const fs = require("fs"); 
if(!fs.existsSync("./config/default.json")){
  if (!fs.existsSync("config")) {
    fs.mkdirSync("config");
  }
  console.log("No config file found creating")
  defaultConfig={
    "browserExecutablePath": "./browser/chrome-win/chrome.exe",
    "randomDelay": 5000,
    "searchDelay": 5000,
    "searchPageDelay": 20000,
    "accountDelay": 60000,
    "updateCookies": true,
    "maxPcSearches": 35,
    "maxMobileSearches": 45,
    "doDailySet": true,
    "stopOnMaxEarned": true,
    "pcUserAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36 Edge/18.18363",
    "mobileUserAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) CriOS/54.0.2840.66 Mobile/16A366 Safari/602.1",
    "accounts": [
      "fake_account@fakedomain.com"
    ],
    "passwords":[
      "password123"
    ],
    "proxys": []
  }
  fs.writeFileSync("./config/default.json",JSON.stringify(defaultConfig,null,2))
  console.log("config file generated: Exiting")
  process.exit(0)
}
const puppeteer = require('puppeteer');
const config = require('config');
// const pathToMicrosoftRewards= require('path').join(__dirname, 'microsoftRewards/1.5_0');
require('./helper.js')(config,fs);

const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
})

var searches=[]

async function doSearches(browser,deviceType,account,password,proxy){
  var pages = await browser.pages();
  var mainPage=pages[0]
  if(deviceType==0){
    await mainPage.setUserAgent(config.get("pcUserAgent"))
  }else{
    await mainPage.setUserAgent(config.get("mobileUserAgent"))
  }
  try{
    await loadCookies("bing",account,mainPage,true)
  }catch(e){
    // console.log("Error Load Cookies For "+account)
    // try{
    //   await mainPage.goto("https://www.bing.com/?setmkt=en-us&setlang=en-us", { waitUntil: 'load', timeout: 0 });
    // }catch(e){
    //   console.log("Error Loading Page: "+e)
    // }
    // await new Promise(async(resolve, reject) => {
    //   readline.question("\n\nlogin to the Bing and press enter here when done:",async function(){
    //     return resolve(true);  
    //   })
    // })
    // try{
    //   await mainPage.goto("https://www.bing.com/?setmkt=en-us&setlang=en-us", { waitUntil: 'load', timeout: 0 });
    // }catch(e){
    //   console.log("Error Loading Page: "+e)
    // }
    // await saveCookies("bing",account,mainPage)
  }
  try{
    await mainPage.goto("https://www.bing.com/?setmkt=en-us&setlang=en-us", { waitUntil: 'load', timeout: 0 });
  }catch(e){
    console.log("Error Loading Page: "+e)
  }
  if(deviceType==0){
    await mainPage.waitForSelector('#id_l')
    await sleep(10000)
    console.log("login")
    await bingLogin(mainPage,account,password)
    console.log("done login")
  }
  console.log("done logging in")
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
    await loadCookies("bing",account,mainPage,true)
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
  for(var x=0;x<3;x++){
    try{
      var clickReturn=await clickDailySet(mainPage,x)
      if(clickReturn=="done"){
        console.log("Daily Set "+x+" Already Done")
      }else{
        await new Promise((resolve) => {
          setTimeout(resolve, 5000);
          setInterval(async function(){
            if((await browser.pages()).length>1){
              resolve()
            }
          },100)
        });
        pages = await browser.pages();
        if(pages.length>1){
          await pages[1].reload({ waitUntil: ["networkidle0", "domcontentloaded"] });
          sleep(5000)
          console.log("starting quiz")
          await eval(`
            pages[1].evaluate(async function(){
              if(document.querySelector(".TriviaOverlayData")){//lower third
                if(document.querySelector("#rqStartQuiz")){//quiz
                  document.querySelector("#rqStartQuiz").click()
                }
              }
            })
          `)
          await sleep(2000)
          var quizType=await eval(`
            pages[1].evaluate(async function(){
              if(document.querySelector(".btQueTtle")&&document.querySelector(".btQueTtle").innerText=="This or that?"){//this or that
                return 1//this or that
              }else if(document.querySelector(".rqTitle")&&document.querySelector(".rqTitle").innerText=="Rewards quiz"){
                return 2//supersonic
              }else if(document.querySelector(".bt_title")&&document.querySelector(".bt_title").innerText=="Today's Rewards poll"){
                return 3//poll
              }else if(document.querySelector(".b_focusLabel")&&document.querySelector(".b_focusLabel").innerText=="Bing homepage quiz"){
                return 4//homepage quiz
              }else{
                return 0
              }
            })
          `)
          console.log("Quiz Type: "+quizType)

          switch(quizType){
            case 1:
              for(var question=0;question<7;question++){
                await eval(`
                  pages[1].evaluate(async function(){
                    var options=document.getElementsByClassName("btOptionCard")
                    options[parseInt(Math.random()*1.9)].click()
                  })
                `)
                await sleep(5000)
              }
            break
            case 2:
              for(var question=0;question<20;question++){
                if(question%5==0){
                  try{
                    await pages[1].click('#rqAnswerOption0')
                  }catch(ignore){console.log("Error Clicking")}
                }
                console.log(await eval(`
                  pages[1].evaluate(async function(){
                    if(document.querySelector(".btOptions")){
                      for(var option of document.querySelector(".btOptions").children){
                        if(option.children[0].getAttribute("iscorrectoption")=="True"){
                          option.children[0].click()
                        }
                      }
                      return "Subtype 1"
                    }else{
                      for(var option of document.getElementsByClassName("rq_button")){
                        option.querySelector("input").click()
                      }
                      return "Subtype 2"
                    }
                  })
                `))
                await sleep(3000)
              }
            break
            case 3:
              await eval(`
                pages[1].evaluate(async function(){
                  btoption0.click()
                })
              `)
              await sleep(3000)
            break
            case 4:
              for(var question=0;question<7;question++){
                try{
                  await eval(`
                    pages[1].evaluate(async function(){
                      document.getElementsByClassName("b_vPanel")[document.getElementsByClassName("b_vPanel").length-1].querySelector(".wk_paddingBtm").onmouseup()
                    })
                  `)
                  await sleep(500)
                  await eval(`
                    pages[1].evaluate(async function(){
                      WKQuiz_V2.showQuestionPane()             
                    })
                  `)
                  await sleep(500)
                }catch(ignore){}
              }
            break
            default:
              console.log("unknown quiz type")
            break
          }          
        }else{
          console.log("Daily Set Did Not Open New Page")
        }
      }
    }catch(e){
      console.log("daily set "+x+"failed: "+e)
    }
    if(pages.length>1){
      pages[1].close()
    }
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
}

async function run(account,password,proxy) {
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
  var balance=await doSearches(browser,0,account,password,proxy)
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
  await run(config.get("accounts")[accountNum],config.get("passwords")[accountNum],config.get("proxys")[accountNum])
  accountNum++
  if(accountNum>=config.get("accounts").length){
    console.log("All Accounts Done: Exiting")
    process.exit(0)
  }
  console.log("waiting "+config.get("accountDelay")/1000+" seconds for next account")
  setTimeout(main,config.get("accountDelay"))
}
main()