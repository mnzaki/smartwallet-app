import Immutable from 'immutable'
import { makeActions } from '../'
import * as router from '../router'
import util from 'lib/util'

const storeIdCardDetailsInBlockchain = ({idCard, webId, services}) => {
  const {wallet} = services.auth.currentUser
  return wallet.addAttributeHashToIdentity(
    {
      attributeId: 'idCard',
      attribute: {
        birthCountry: idCard.idCardFields.birthCountry,
        birthDate: idCard.idCardFields.birthDate,
        birthPlace: idCard.idCardFields.birthPlace,
        expirationDate: idCard.idCardFields.expirationDate,
        firstName: idCard.idCardFields.firstName,
        gender: idCard.idCardFields.gender,
        lastName: idCard.idCardFields.lastName,
        number: idCard.idCardFields.number,
        city: idCard.idCardFields.city,
        country: idCard.idCardFields.country,
        state: idCard.idCardFields.state,
        streetWithNumber: idCard.idCardFields.streetWithNumber,
        zip: idCard.idCardFields.zip
      },
      definitionUrl:
        `${util.webidRoot(webId)}/profile/idCard${idCard.id}`,
      pin: '1234',
      identityAddress: wallet.identityAddress
    }
  )
}

const __WINDOW_TO_URL__ = {
  contact: '/wallet/identity/contact',
  drivingLicence: '/wallet/identity/drivers-licence',
  identity: '/wallet/identity/',
  passport: '/wallet/identity/passport/add',
  idCard: '/wallet/identity/id-card'
}

const actions = module.exports = makeActions('wallet/identity', {
  changePinValue: {
    expectedParams: ['attrType', 'value', 'index', 'codeType']
  },
  expandField: {
    expectedParams: ['field', 'value']
  },
  getIdCardVerifications: {
    expectedParams: [],
    async: true,
    creator: (params) => {
      return (dispatch, getState, {services, backend}) => {
        dispatch(actions.getIdCardVerifications.buildAction(params, async() => { // eslint-disable-line max-len
          let numOfVerification = await services.auth.currentUser.wallet
          .identityContract.getNumberOfVerifications({
            attributeId: 'idCard',
            identityAddress: services.auth.currentUser.wallet.identityAddress
          })
          return numOfVerification.toNumber()
        }))
      }
    }
  },
  getIdentityInformation: {
    expectedParams: [],
    async: true,
    creator: (params) => {
      return (dispatch, getState, {services, backend}) => {
        dispatch(actions.getIdentityInformation.buildAction(params, () =>
          services.auth.currentUser.wallet.getUserInformation()
            .then((result) => {
              dispatch(actions.getIdCardVerifications())
              return result
            })
        ))
      }
    }
  },
  setAttributeVerified: {
    expectedParams: ['attrType', 'attrId', 'verified']
  },
  getWalletAddressAndBalance: {
    expectedParams: [],
    async: true,
    creator: (params) => {
      return (dispatch, getState, {services, backend}) => {
        dispatch(actions.getWalletAddressAndBalance.buildAction(params, () => {
          return services.auth.currentUser.wallet.getWalletAddress()
          .then((result) => {
            return backend.gateway.getBalanceEther({
              userName: services.auth.currentUser.wallet.userName,
              walletAddress: result.walletAddress
            })
          })
        }))
      }
    }
  },
  buyEther: {
    expectedParams: ['stripeToken'],
    async: true,
    creator: (params) => {
      return (dispatch, getState, {services}) => {
        dispatch(actions.buyEther.buildAction(params, (backend) => {
          return services.auth.currentUser.wallet.getWalletAddress()
          .then((result) => {
            return backend.gateway.buyEther({
              stripeToken: params,
              walletAddress: result.walletAddress
            })
          })
        }))
      }
    }
  },
  createEthereumIdentity: {
    expectedParams: [],
    async: true,
    creator: (params) => {
      return (dispatch, getState, {services}) => {
        dispatch(actions.createEthereumIdentity.buildAction(params, (backend) => { // eslint-disable-line max-len
          return services.auth.currentUser.wallet.getWalletAddress()
          .then((result) => {
            return backend.gateway.createEthereumIdentityContract({
              seedPhrase: services.auth.currentUser.wallet.seedPhrase,
              userName: services.auth.currentUser.wallet.userName,
              walletAddress: result.walletAddress
            })
          })
        }))
      }
    }
  },
  goTo: {
    expectedParams: ['value'],
    creator: (params) => {
      return (dispatch) => {
        dispatch(router.pushRoute(__WINDOW_TO_URL__[params]))
      }
    }
  },
  saveToBlockchain: {
    expectedParams: ['index'],
    async: true,
    creator: (index) => {
      return (dispatch, getState, {services, backend}) => {
        const idCard = getState().toJS().wallet.identity.idCards[index]
        const { webId } = getState().toJS().wallet.identity
        dispatch(actions.saveToBlockchain.buildAction(index, () => {
          return storeIdCardDetailsInBlockchain({idCard, webId, services})
        }))
      }
    }
  },
  setFocusedPin: {
    expectedParams: ['value', 'index']
  },
  setSmsVerificationCodeStatus: {
    expectedParams: ['field', 'index', 'value']
  },
  editDisplayName: {
    expectedParams: [],
    creator: (params) => {
      return (dispatch, getState) => {
        dispatch(actions.editDisplayName.buildAction(params))
      }
    }
  },
  setDisplayName: {
    expectedParams: ['value']
  }
  // saveDisplayName: {
  //   expectedParams: [],
  //   async: true,
  //   creator: () => {
  //     return (dispatch, getState, {services, backend}) => {
  //       const { displayName } = getState().toJS().wallet.identity.displayName.value
  //       dispatch(actions.saveDisplayName.buildAction(() => {
  //         return backend.gateway.proxyGet(params + '/identity/name/display')
  //       }))
  //     }
  //   }
  // }
})

const mapBackendToState = ({ethereum, webId, userName, contact, passports, idCards}) => // eslint-disable-line max-len
  Immutable.fromJS({
    loaded: true,
    error: false,
    webId: webId,
    ethereum: {
      identityAddress: ethereum.identityAddress,
      amount: ethereum.amount,
      walletAddress: ethereum.walletAddress
    },
    username: {value: userName},
    displayName: {
      edit: false,
      value: ''
    },
    expandedFields: {
      ethereum: false,
      contact: false,
      idCards: false,
      passports: false
    },
    contact: {
      emails: contact.email,
      phones: contact.phone
    },
    passports: passports,
    idCards: idCards
  })
const mapBackendToStateError = () => Immutable.fromJS({error: true})

const initialState = Immutable.fromJS({
  loaded: false,
  error: false,
  webId: '',
  username: {
    verified: false,
    value: ''
  },
  displayName: {
    edit: false,
    value: ''
  },
  expandedFields: {
    ethereum: false,
    contact: false,
    idCards: false,
    passports: false
  },
  ethereum: {
    walletAddress: '',
    amount: '',
    identityAddress: ''
  },
  contact: {
    phones: [{
      type: '',
      number: '',
      verified: false,
      smsCode: '',
      pin: '',
      codeIsSent: false,
      pinFocused: false
    }],
    emails: [{
      type: '',
      address: '',
      pin: '',
      verified: false
    }]
  },
  passports: [{
    number: '',
    givenName: '',
    familyName: '',
    birthDate: '',
    gender: '',
    showAddress: '',
    streetAndNumber: '',
    city: '',
    zip: '',
    state: '',
    country: '',
    verified: false
  }]
})

const changePinValue = (state, {attrType, index, value, codeType = 'pin'}) => {
  if (/^[0-9]{0,6}$/.test(value)) {
    return state.setIn(['contact', attrType, index, codeType], value)
  }
  return state
}

module.exports.default = (state = initialState, action = {}) => {
  switch (action.type) {
    case actions.changePinValue.id:
      return changePinValue(state, action)

    case actions.expandField.id:
      return state.setIn(['expandedFields', action.field], action.value)

    case actions.getIdCardVerifications.id_success:
      return state.mergeIn(['idCards', '0'], {verified: action.result > 0})

    case actions.getIdentityInformation.id_fail:
      return mapBackendToStateError(state)

    case actions.getIdentityInformation.id_success:
      return mapBackendToState(action.result)

    case actions.saveToBlockchain.id_success:
      return state.mergeIn(['idCards', action.index], {savedToBlockchain: true})

    case actions.setFocusedPin.id:
      return state.setIn(['contact', 'isCodeInputFieldFocused'], action.value)

    case actions.setSmsVerificationCodeStatus.id:
      return state.mergeIn(['contact', action.field, action.index], {
        codeIsSent: action.value
      })

    case actions.getWalletAddressAndBalance.id:
      return state.mergeDeep({
        loaded: false,
        error: ''
      })

    case actions.getWalletAddressAndBalance.id_success:
      return state.mergeDeep({
        loaded: true,
        error: '',
        ethereum: {
          amount: parseFloat(action.result.ether)
        }
      })

    case actions.getWalletAddressAndBalance.id_fail:
      return state.mergeDeep({
        loaded: true,
        error: 'Could not get your walletAddress and Balance'
      })

    case actions.buyEther.id:
      return state.merge({
        loaded: false
      })

    case actions.buyEther.id_success:
      return state.merge({
        loaded: true
      })

    case actions.buyEther.id_fail:
      return state.merge({
        loaded: true,
        error: true
      })

    case actions.createEthereumIdentity.id:
      return state.merge({
        loaded: false
      })

    case actions.createEthereumIdentity.id_success:
      return state.mergeDeep({
        loaded: true,
        error: false,
        ethereum: {
          identityAddress: action.result.identityAddress
        }
      })

    case actions.createEthereumIdentity.id_fail:
      return state.merge({
        loaded: true,
        error: true
      })

    case actions.setAttributeVerified.id:
      if (!state.get('loaded')) {
        return state
      }

      let path
      if (['email', 'phone'].indexOf(action.attrType) >= 0) {
        path = ['contact', action.attrType + 's']
      } else if (['idcard', 'passport'].indexOf(action.attrType) >= 0) {
        path = [action.attrType === 'idcard' ? 'idCards' : 'passports']
      }

      const index = state.getIn(path).findIndex(attr => {
        return attr.get('id') === action.attrId
      })
      if (index >= 0) {
        path.push(index)
      } else {
        return state
      }
      path.push('verified')

      return state.setIn(path, action.verified)

    case actions.editDisplayName.id:
      return state.mergeIn(['displayName'], {
        edit: true
      })

    case actions.setDisplayName.id:
      return state.mergeIn(['displayName'], {
        value: action.value
      })

    default:
      return state
  }
}
