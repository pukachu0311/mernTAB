
const Account=require('../models/signUp.model');
const Hotel=require('../models/hotel.model');

const RoomT = require('../models/roomTest.model');
const { resolve } = require('path');
const { rejects } = require('assert');
const axios =require('axios')
const { generalAccessTokens, refreshAccessTokens, paymentToken } = require('./jwt');
const { search } = require('../routes/BookRoom/book.route');
const { Invoice } = require('../models/invoice.model');

function signUpOwner(newOwner){
    return new Promise(async (resolve,rejects)=>{
        const{name,passWord,email,birthDate,phoneNum,address,dueDatePCCC,dueDateKD}=newOwner
        try{
            const checkAccountExisted=await Account.Account.findOne({
                email:email
            })
            if(checkAccountExisted!==null){
                resolve({
                    status:'BAD',
                    message:'Đã tồn tại email'
                })
            }
            const createdOwner=await Account.Account.create({
                name,
                passWord,
                email,
                birthDate,
                phoneNum,
                address,
                dueDatePCCC,
                dueDateKD
            })
            if(createdOwner){
                resolve({
                    status:'OK',
                    message:'Succ',
                    data:createdOwner
                })
            }
        } catch(e){
            rejects(e)
        }
    })
}

function signInOwner(existedOwner){
    return new Promise(async(resolve,rejects)=>{
        const {email,passWord}=existedOwner
        try{
            const foundOwner= await Account.Account.findOne({
                email:email
            })
            if(foundOwner==null){
                resolve({
                    status:'BAD',
                    message: 'You havent registed'
                })
            }
            if(foundOwner.passWord!=passWord){
                resolve({
                    status:'BAD',
                    message:'Wrong password'
                })
            }
            const access_token=await generalAccessTokens({
                id:foundOwner._id,
                isUse:foundOwner.isUse
            })
            const refresh_token=await refreshAccessTokens({
                id:foundOwner._id,
                isUse:foundOwner.isUse
            })

            resolve({
                status:'OK',
                message:'Success log in',
                access_token: access_token,
                refresh_token: refresh_token,
                ownerID: foundOwner._id
            })
        }catch(e){
            rejects(e)
        }
    })
}
function signUpCustomer(newCustomer){
    return new Promise(async(resolve,rejects)=>{
        const{name,passWord,email,birthDate,phoneNum}=newCustomer
        try{
            const checkCustomerExisted=await Account.Customer.findOne({
                email:email
            })
            if(checkCustomerExisted!==null){
                return rejects({
                    status:'BAD',
                    message:'Existed cus'
                })
            }
            const createCustomer= await Account.Customer.create({
                name,
                passWord,
                email,
                birthDate,
                phoneNum
            })
            if(createCustomer){
                resolve({
                    status:'OK',
                    message:'Succesfully created customer',
                    data:createCustomer
                })
            }
        }catch(e){
            rejects(e)
        }
    })
}
//đẩy qua bên khác
function signInCustomer(existedCustomer){
    return new Promise(async(resolve,rejects)=>{    
        const {email,passWord}=existedCustomer 
        try{
            const response=await axios.post('/appdangnhap',{
                email:email,
                password:passWord
            })
            if(response.status===200){
                const access_token=await generalAccessTokens({
                    id:response.data.id
                })
                resolve({
                    status:'OK',
                    message:'Successfully signed in as cus',
                    access_token:access_token
                })
            }else{
                resolve({
                    status:'BAD',
                    message:'Third-party service auth failed'
                })
            }
        }catch(e){
            console.log(e)
            rejects(e)
        }
    })
}

//truyền qua token của cus tạo từ signInCus, roomID nhập tay
//chưa đủ các điều kiện, chưa có controller+route
async function bookRoom(newInvoice, cusID,roomID){
    return new Promise(async(resolve,reject)=>{
        const {paymentMethod}=newInvoice
        try{
            //ko có phòng, đă dc book
            const foundRoom=await Hotel.Room.findById(roomID)
            if (!foundRoom) {
                return reject({
                    status: 'BAD',
                    message: 'Room not found'
                });
            }

            if (!foundRoom.isAvailable) {
                return reject({
                    status: 'BAD',
                    message: 'Room is booked'
                });
            }
            const roomPrice =foundRoom.money
            const total =roomPrice +(roomPrice*0.08) //vat
            //tạo biên lai
            const invoice = await Invoice.create({
                cusID,
                roomID,
                total,
                paymentMethod
            });

            const payment_token=await paymentToken({
                invoiceID:invoice._id,
                cusID,
                total
            })

            //đẩy thanh toán qua bên t3
            const paymentResponse=await axios.post('/appthanhtoan',{
                token:payment_token,
                total,
                cusID
            })
            if(paymentResponse.status===200){
                invoice.isPaid=true
                await invoice.save()
            //đổi trạng thái phòng thủ công(chưa theo ngày)
                foundRoom.isAvailable=false
                await foundRoom.save()
                resolve({
                    status: 'OK',
                    message: 'Room booked successfully',
                    data: invoice
                });
            }
            else {
                reject({
                    status: 'BAD',
                    message: 'Payment failed',
                })
            }
            
        }catch(e){
            console.log('e in promise'+e)
            reject(e)
        }
    })
}
//phải nhập id chủ nhà
    function createHotel(newHotel,ownerID){
        return new Promise(async(resolve,rejects)=>{
            const{address,numberOfRooms,taxCode,companyName,nation,facilityName,businessType,scale,city}=newHotel
            try{
                console.log(ownerID)
                const checkExistedOwnerID=await Account.Account.findOne({
                    _id:ownerID
                })
                if(!checkExistedOwnerID){
                    return rejects({
                        status:'BAD',
                        message:'Owner ID does not exist'
                    })
                }
                const createdHotel = await Hotel.Hotel.create({
                    address,
                    numberOfRooms,
                    taxCode,
                    companyName,
                    nation,
                    facilityName,
                    businessType,
                    scale,
                    city,
                    ownerID
                });
                if(createdHotel){
                    resolve({
                    status: 'OK',
                    message: 'Hotel created successfully',
                    data: createdHotel
                });
                }
            } catch(e){
                rejects(e)
            }
        })
    }
    //truyền HotelID và token chủ nhà
    const createRoom = async (newRoom, hotelID) => {
        return new Promise(async (resolve, reject) => {
            const { numberOfBeds, typeOfRoom, money,capacity } = newRoom;
            try {
                const createdRoom = await Hotel.Room.create({
                    numberOfBeds,
                    typeOfRoom,
                    money,
                    capacity,
                    hotelID
                });
                if (createdRoom) {
                    const hotel = await Hotel.findById(hotelID);
                    if (hotel) {
                    if (hotel.minPrice === 0 || hotel.minPrice > money) {
                        hotel.minPrice = money;
                        await hotel.save();
                    }
                    }
                    resolve({
                        status: 'OK',
                        message: 'Room created successfully',
                        data: createdRoom
                    });
                }
            } catch (e) {
                console.error("Error in createRoom service:", e);
                reject(e);
            }
        });
    }
//chỉ cần truyền token
const getHotelsByOwner = async (ownerID) => {
    try {
        return await Hotel.Hotel.find({ ownerID });
    } catch (e) {
        console.error("Error in getHotelsByOwner service:", e);
        throw e;
    }
};

const searchHotel=async(searchCriteria)=>{
    const {city, checkInDate, checkOutDate, numberOfPeople}=searchCriteria
    try{
        const hotelCity=await Hotel.Hotel.find({city})

        const availableHotels= await Promise.all(
            hotelCity.map(async(h)=>{
                const hotelRooms = await Hotel.Room.find({
                    hotelID:h._id,
                    capacity:{ $gte: numberOfPeople } //>= số ng dc nhập
                })
                if (hotelRooms.length > 0) {
                    return {
                        ...h._doc,
                        rooms: hotelRooms
                    };
                } else return null;
            }))
        const filteredHotels=availableHotels.filter(hotel=>hotel!==null)

        return {
            status: 'OK',
            message: 'Find Hotel successfully',
            data: filteredHotels
        };
    }
    catch(e){
        console.error("There's no Hotel in your search place:", e);
    }
}


module.exports={
    signUpOwner,
    createHotel,
    signInOwner,
    signUpCustomer,
    signInCustomer,
    createRoom,
    getHotelsByOwner,
    bookRoom,
    searchHotel
}