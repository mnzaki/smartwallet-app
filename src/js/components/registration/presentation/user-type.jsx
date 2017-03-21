import React from 'react'
import Radium from 'radium'
import {FlatButton} from 'material-ui'
import Theme from '../../../styles/jolocom-theme'
import RegistrationStyles from '../styles'
import HoverButton from '../../common/hover-button'

const STYLES = Object.assign(RegistrationStyles, {
  header: {
    marginTop: '40px',
    marginBottom: '30px'
  },
  tile: {
    display: 'flex',
    maxwidth: '90%',
    height: '150px',
    width: '300px',
    alignItems: 'center',
    marginTop: '10px',
    marginBottom: '10px',
    borderRadius: '2px',
    primary: false,
    backgroundColor: Theme.jolocom.gray1,
    selectedColor: Theme.palette.primary1Color,
    textAlign: 'center'
  },

  tileinside: {
    color: Theme.jolocom.gray5,
    padding: '5px 5px 5px 5px',
    margin: '0px'
  },
  img: {
    position: 'relative',
    flex: 1,
    maxWidth: '100%',
    height: '80px',
    width: '300px',
    userSelect: 'none',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'contain',
    marginBottom: '10px'

  }

})

const UserType = (props) => {
  var messageWhy = 'If you select the Geek option, you are the keeper of your \
   passphrase that was randomly generated by the mouse moving you just did \
   to uncover the picture. You must be prepared to keep the passphrase you \
   in a safe place where you are not going to loose it and where others \
   can\'t get to it. This phrase + a secret pin is how you \'login\' to the \
   save your passphrase for you, but you will then need a password to get it'

  var messageConfirm = 'You have selected ' + (props.value === 'expert'
   ? '\'Geek\'. Do you have pencil and paper ready to save your passphrase \
   securely for accessing your wallet in the future?' : '\'No hassle\' and \
   we\'ll save your passphrase for you')
  var messageSelect = 'Please make a selection. If you are not sure, checkout \
   \'WHY?\''
  return <div style={STYLES.container}>
    <div style={STYLES.header}>
      {'Hi' + props.user + '!, are you...'}
    </div>
    <div>
      <HoverButton
        backgroundColor={(props.value === 'expert'
        ? STYLES.tile.selectedColor : STYLES.tile.backgroundColor)}
        hoverColor={STYLES.tile.selectedColor}
        style={STYLES.tile}
        onClick={() => { props.onChange('expert'); props.onSubmit() }}>
        <div style={STYLES.tileinside}>
          <div style={{...STYLES.img, ...{
            backgroundImage: 'url(/img/img_techguy.svg)'
          }}} />
        ...a total tech Geek and want to be in absolute control?
        </div>
      </HoverButton>
    </div>
    <div>
      <HoverButton
      backgroundColor={(props.value === 'layman' ?
      STYLES.tile.selectedColor : STYLES.tile.backgroundColor)}
        hoverColor={STYLES.tile.selectedColor}
        style={STYLES.tile}
        onClick={() => { props.onChange('layman'); props.onSubmit() }}
        onTouchTap={() => { props.onChange('layman'); props.onSubmit() }}>
        <div style={STYLES.tileinside}>
          <div style={{...STYLES.img, ...{
            backgroundImage: 'url(/img/img_nohustle.svg)'
          }}} />
          ...the laid-back type, who doesn't want any hassle.
        </div>
      </HoverButton>
    </div>
    <div>
    </div>
    <div>
      <FlatButton onClick={() => {
        props.configSimpleDialog(messageWhy); props.showSimpleDialog()
      }}>
      WHY?
      </FlatButton>
    </div>
  </div>
}
UserType.propTypes = {
  value: React.PropTypes.string.isRequired,
  valid: React.PropTypes.bool.isRequired,
  onChange: React.PropTypes.func.isRequired,
  onSubmit: React.PropTypes.func.isRequired,
  openConfirmDialog: React.PropTypes.func,
  closeConfirmDialog: React.PropTypes.func,
  configSimpleDialog: React.PropTypes.func,
  showSimpleDialog: React.PropTypes.func,
  user: React.PropTypes.string
}

export default Radium(UserType)
