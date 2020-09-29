const express = require('express')
const app = express()
var path = require('path')
var request = require('request')
var jwt = require('jsonwebtoken')
var mysql = require('mysql')
var auth = require('./lib/auth')//내가 만든 라이브러리 임포트 할 때는 path 지정!


// DB 커넥팅
var connection  = mysql.createConnection({
    connectionLimit : 10,
    host            : 'localhost',
    user            : 'root',
    password        : '119550',
    database        : 'fintech0511'
  }); 


  // 1. 템플릿 엔진 및 디렉토리 설정
app.set('views', path.join(__dirname, 'views'));
//우리의 루트 프로젝트에서 
//ejs 파일이 있는 위치(views 디렉토리) 알려줌
//__dirname은 현재 작업디렉토리(여기선 TEST)
app.set('view engine', 'ejs');
//ejs 템플릿 엔진 사용

// 2. 디자인 자원 및 json 데이터 사용
app.use(express.static(path.join(__dirname, 'public')));
//to use static asset
//퍼블릭 디렉토리 밑에 있는 디자인 자원 사용할 것!
app.use(express.json()) //json타입 허용
app.use(express.urlencoded({extended:false}))


//데이터 전송 라우터 추가
app.get('/dataSend', function(req,res){
    res.render('dataSend')
})

app.post('/getTime',function(req,res){
    var nowTime = new Date()
    res.json(nowTime)
})

app.post('/getData', function(req,res){
    console.log(req.body)
    var userData = req.body.userInputData;
    console.log(userData)
    res.json(userData + "!!!!")
})

//auth라는 미들웨어 추가
app.post('/authTest', auth, function(req,res){
    res.json(req.decoded)
})

//-----------서비스 시작-----------//
app.get('/signup', function(req,res){
    res.render('signup')
})

app.get('/balance', function(req,res){
    res.render('balance')
})

app.get('/qrcode', function(req,res){
    res.render('qrcode')
})

app.get('/authResult', function(req,res){
    var authCode = req.query.code
    console.log(authCode)
    var option = {
        method : "POST",
        url : "https://testapi.openbanking.or.kr/oauth/2.0/token",
        header : {
            'Content-Type' : 'application/x-www-form-urlencoded'
        },
        form : {
            code : authCode,
            client_id : 'u4su7vUk5Oq8ammQV2XnpFOKDe4FOAqRqm8dtq5X',
            client_secret: 'Gdo8Dtn2K3DieHCMhnZ14lJm2BtrfJ8CCydJ5fMR',
            redirect_uri: 'http://localhost:3000/authResult',
            grant_type: 'authorization_code'
        }
    }
    //엑세스 토큰 얻기
    request(option, function(err, response, body){
        if(err){
            console.error(err);
            throw err;
        }
        else {
            var accessRequestResult = JSON.parse(body);
            console.log(accessRequestResult);
            res.render('resultChild', {data : accessRequestResult} )
        }
 
    })
})

//회원가입
app.post('/signup', function(req,res){
    //데이터 받아서 db에 저장하기
    var userName = req.body.userName
    var userEmail = req.body.userEmail
    var userPassword = req.body.userPassword
    var userAccessToken = req.body.userAccessToken
    var userRefreshToken = req.body.userRefreshToken
    var userSeqNo = req.body.userSeqNo
    console.log(userName, userAccessToken, userSeqNo)
    var sql = "INSERT INTO fintech0511.user (name, email, password, accesstoken, refreshtoken, userseqno) VALUES (?,?,?,?,?,?)"
    connection.query(
        sql, 
        [userName,userEmail, userPassword, userAccessToken, userRefreshToken, userSeqNo],
        function(err,result){
            if(err){
                console.error(err)
                res.json(0)
                throw err
            }
            else{
                res.json(1)
            }
    })
})

//로그인 페이지 그리기
app.get('/login', function(req,res){
    res.render('login')
})

app.get('/qr', function(req,res){
    res.render('qrReader')
})

//메인 페이지 그리기
app.get('/main', function(req,res){
    res.render('main')
})

app.post('/login', function(req,res){
    var userEmail = req.body.userEmail
    var userPassword = req.body.userPassword
    var sql = "SELECT * FROM user WHERE email = ?" 
    connection.query(sql, [userEmail], function(err,result){
        if(err){
            console.error(err)
            res.json(0)
            throw err
        }
        else{
            if(result.length == 0){
                res.json(3) // 없는 id인 경우
            }
            else{
                var dbPassword = result[0].password
                if(dbPassword == userPassword){
                    //login 성공
                    var tokenKey = "f@i#n%tne#ckfhlafkd0102test!@#%"
                    jwt.sign(
                        {
                            userId : result[0].id,
                            userEmail : result[0].email
                        },
                        tokenKey,
                        {
                            expiresIn : '10d',
                            issuer : 'fintech.admin',
                            subject : 'user.login.info'
                        },
                        function(err, token){
                            console.log('로그인 성공', token)
                            res.json(token)
                        })
                }
                else{
                    res.json(2)
                }
            }
        }
    })
})

//사용자정보조회 기능 구현(메인)
app.post('/list', auth, function(req, res){
    // api response body 
    var userId = req.decoded.userId
    var sql = "SELECT * FROM user WHERE id =?"
    connection.query(sql, [userId], function(err, result){
        if(err){
            console.error(err);          
            throw err;
        }
        else{
            //console.log(result)
            var option = {
                method : "GET",
                url : "https://testapi.openbanking.or.kr/v2.0/user/me",
                headers : {
                    Authorization : "Bearer" + result[0].accesstoken
                },
                qs : {
                    user_seq_no : result[0].userseqno
                }
            }
            request(option, function(err, response, body){
                if(err){
                    console.error(err)
                    throw err
                }
                else{
                    var accessRequestResult = JSON.parse(body)
                    //console.log(accessRequestResult)
                    res.json(accessRequestResult)
                }
            })
        }
    })
})

//잔액조회 기능 구현
app.post('/balance', auth, function(req,res){
    var userId =req.decoded.userId
    var fin_use_num =req.body.fin_use_num

    var countnum = Math.floor(Math.random() * 1000000000) + 10;
    var transId ="T991608630U" + countnum

    var sql = "SELECT * FROM user WHERE id =?"
    connection.query(sql, [userId], function(err, result){
        if(err){
            console.error(err);       
            throw err;
        }
        else{
            console.log(result)
            var option = {
                method : "GET",
                url : "https://testapi.openbanking.or.kr/v2.0/account/balance/fin_num",
                headers : {
                    Authorization : "Bearer" + result[0].accesstoken
                },
                qs : {
                    bank_tran_id : transId,
                    fintech_use_num : fin_use_num,
                    tran_dtime : 20200515113200
                }
            }
            request(option, function(err, response, body){
                if(err){
                    console.error(err)
                    throw err
                }
                else{
                    var accessRequestResult = JSON.parse(body)
                    console.log(accessRequestResult)
                    res.json(accessRequestResult)
                }
            })
        }
    })
})

//거래내역 조회 기능 구현
app.post('/transactionlist', auth, function(req,res){
    var userId =req.decoded.userId
    var fin_use_num =req.body.fin_use_num

    var countnum = Math.floor(Math.random() * 1000000000) + 10;
    var transId ="T991608630U" + countnum

    var sql = "SELECT * FROM user WHERE id =?"
    connection.query(sql, [userId], function(err, result){
        if(err){
            console.error(err);       
            throw err;
        }
        else{
            console.log(result)
            var option = {
                method : "GET",
                url: "https://testapi.openbanking.or.kr/v2.0/account/transaction_list/fin_num",
                headers : {
                    Authorization : "Bearer" + result[0].accesstoken
                },
                qs : {
                    bank_tran_id : transId,
                    fintech_use_num : fin_use_num,
                    inquiry_type : 'A',
                    inquiry_base : 'D',
                    from_date : 20200514,
                    to_date : 20200515,
                    sort_order : 'D',
                    tran_dtime : 20200515134500
                }
            }
            request(option, function(err, response, body){
                if(err){
                    console.error(err)
                    throw err
                }
                else{
                    var accessRequestResult = JSON.parse(body)
                    console.log(accessRequestResult)
                    res.json(accessRequestResult)
                }
            })
        }
    })  
})

//출금이체 기능 구현
app.post('/withdraw', auth, function(req,res){
    console.log("출금 요청")
    var userId =req.decoded.userId
    var fin_use_num =req.body.fin_use_num
    var amt =req.body.amount

    var countnum = Math.floor(Math.random() * 1000000000) + 10;
    var transId ="T991608630U" + countnum

    var sql = "SELECT * FROM user WHERE id =?"
    connection.query(sql, [userId], function(err, result){
        if(err){
            console.error(err);       
            throw err;
        }
        else{
            //console.log(result)
            var option = {
                method : "POST",
                url: "https://testapi.openbanking.or.kr/v2.0/transfer/withdraw/fin_num",
                headers : {
                    Authorization : "Bearer" + result[0].accesstoken,
                    "Content-Type" : "application/json"
                },
                json: {
                    "bank_tran_id": transId,
                    "cntr_account_type": "N",
                    "cntr_account_num": "6043737028",
                    "dps_print_content": "환불금",
                    "fintech_use_num": fin_use_num,
                    "wd_print_content": "오픈뱅킹출금",
                    "tran_amt": amt,
                    "tran_dtime": "20200516165220",
                    "req_client_name": result[0].name,
                    "req_client_fintech_use_num" : fin_use_num,
                    "req_client_num": result[0].id,
                    "transfer_purpose": "TR",
                    "recv_client_name": "전다희",
                    "recv_client_bank_code": "097",
                    "recv_client_account_num": "1002548016777"
                }
            }
            request(option, function(err, response, body){
                if(err){
                    console.error(err);
                    throw err;
                }
                else {
                    console.log(body);
                    if(body.rsp_code == 'A0000'){
                        res.json(1)
                    }
                }
            })
        }
    })
})

//입금이체 기능 구현
app.post('/deposit', auth, function(req,res){
    console.log("입금 요청")
    var userId =req.decoded.userId
    var fin_use_num =req.body.fin_use_num
    var amt =req.body.amount

    var countnum = Math.floor(Math.random() * 1000000000) + 10;
    var transId ="T991608630U" + countnum

    var sql = "SELECT * FROM user WHERE id =?"
    connection.query(sql, [userId], function(err, result){
        if(err){
            console.error(err);       
            throw err;
        }
        else{
            //console.log(result)
            var option = {
                method : "POST",
                url: " https://testapi.openbanking.or.kr/v2.0/transfer/deposit/fin_num",
                headers : {
                    Authorization : "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJUOTkxNjA4NjMwIiwic2NvcGUiOlsib29iIl0sImlzcyI6Imh0dHBzOi8vd3d3Lm9wZW5iYW5raW5nLm9yLmtyIiwiZXhwIjoxNTk3Mzk5Njk3LCJqdGkiOiJlN2UzNGI4ZS0yNWNiLTRlYjYtYjRhOS1lMGExNDc3YTJmMGQifQ.b6r0Y32Hj8HNirkyfsJJzv5DbiPfF_23xLhRcFsTC5A",
                    "Content-Type" : "application/json"
                },
                json: {
                    "cntr_account_type" : "N",
                    "cntr_account_num" : "4646836760",
                    "wd_pass_phrase": "NONE",
                    "wd_print_content": "환불금액",
                    "name_check_option" :"off",
                    "tran_dtime" : "20200516184000",
                    "req_cnt" : "1",
                    "req_list":[{
                        "tran_no" : "1",
                        "bank_tran_id" : transId,
                        "fintech_use_num" : fin_use_num,
                        "print_content": "쇼핑물환불",
                        "tran_amt" : amt,
                        "req_client_name" : result[0].name,
                        //"req_client_fintech_use_num" : fin_use_num,
                        "req_client_num" : result[0].id,
                        "transfer_purpose": "TR"}]
                    }                    
            }
            request(option, function(err, response, body){
                if(err){
                    console.error(err);
                    throw err;
                }
                else {
                    //console.log(body);
                    if(body.rsp_code == 'A0000'){
                        res.json(1)
                    }
                }
            })
        }
    })
})

app.listen(3000)
