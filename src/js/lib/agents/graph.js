import WebIDAgent from './webid.js'
import LDPAgent from './ldp.js'
import {Writer} from '../rdf.js'
import {PRED} from 'lib/namespaces'
import Util from '../util.js'
import GraphActions from '../../actions/graph-actions'
import D3Convertor from 'lib/d3-converter'

import $rdf from 'rdflib'

// Graph agent is responsible for fetching $rdf data from the server, parsing
// it, and creating a "map" of the currently displayed graph.

class GraphAgent extends LDPAgent {

  /**
   * @summary Populate a object wtih basic / generic node triples.
   * @param {string} uri - The uri of the current node
   * @param {object} writer - A object it adds the triples to
   * @param {string} title - The Name / Title of the node
   * @param {string} description - The Description of a node
   * @param {string} nodeType - The type of the node
   * @return {object} node - The inicial writer with added triples
   */
  baseNode(uri, writer, title, description, nodeType, centerNode) {
    if (!writer || !nodeType || !uri) {
      throw new Error('baseNode: not enough arguments')
    }

    if (title) {
      writer.addTriple($rdf.sym(uri), PRED.title, $rdf.literal(title))
    }
    if (description) {
      writer.addTriple(
        $rdf.sym(uri),
        PRED.description,
        $rdf.literal(description)
      )
    }
    writer.addTriple($rdf.sym(uri), PRED.storage, $rdf.sym(centerNode.storage))
    writer.addTriple($rdf.sym(uri), PRED.maker, $rdf.sym(centerNode.uri))
    // TODO
    if (nodeType === 'image') {
      writer.addTriple($rdf.sym(uri), PRED.type, PRED.Image)
    } else {
      writer.addTriple($rdf.sym(uri), PRED.type, PRED.Document)
    }
    return writer
  }

  /**
   * @summary Adds the image triples to an existing ndoe and uploads an image
   * @param {string} uri - The uri of the current node
   * @param {string} dstContainer - The uri of the folder where the image goes
   * @param {object} writer - A object it adds the triples to
   * @param {blob} image - The image itself
   * @param {bool} confidential - If the img is to be confidential
   */

  addImage(uri, dstContainer, writer, image, confidential) {
    if (!uri || !dstContainer || !writer || !image || confidential) {
      throw new Error('addImage: not enough arguments')
    }
    if (image instanceof File) {
      let imgUri = `${dstContainer}files/${Util.randomString(5)}`
      writer.addTriple($rdf.sym(uri), PRED.image, $rdf.literal(imgUri))
      return this.storeFile(imgUri, null, image, confidential)
    }
    writer.addTriple($rdf.sym(uri), PRED.image, $rdf.literal(image))
    return
  }

  checkImages(nodes) {
    return Promise.all(nodes.map(node => {
      const img = node.img
      if (!img) {
        return
      }
      return this.head(this._proxify(img)).catch((e) => {
        node.img = ''
      })
    }))
  }

  /**
   * @summary Returns all friends a profile has.
   * @param {string} uri - The uri of the profile file.
   */

  findFriends(uri) {
    return this.fetchTriplesAtUri(uri).then(res => {
      return this.findTriples(uri, $rdf.sym(uri), PRED.knows, undefined)
    })
  }

  /**
   * @summary Curates the creation of a new node, delegates to other functions.
   * @param {string} currentUser - Current webID, used for creating acl.
   *                 and connecting to the onwer.
   * @param {object} centerNode - A object describing the center node.
   * @param {string} title - The title of the node.
   * @param {string} description - The description of the new node.
   * @param {blob} image - The image if there's one.
   * @param {string} nodeType - The type [image / text] of the node.
   * @param {bool} confidential - If the img is to be confidential.
   */
  createNode(currentUser, centerNode, nodeInfo) {
    const writer = new Writer()
    const {confidential, title, description, nodeType, image} = nodeInfo
    const newNodeUri = centerNode.storage + Util.randomString(5)

    return this.createACL(newNodeUri, currentUser, confidential)
    .then((uri) => {
      this.baseNode(
        newNodeUri,
        writer,
        title,
        description,
        nodeType,
        centerNode)

      if (image) {
        const storage = centerNode.storage
        return this.addImage(newNodeUri, storage, writer, image, confidential)
      }
    }).then(() => {
      return this.put(Util.uriToProxied(newNodeUri.uri), writer.end(), {
        'Content-Type': 'text/turtle'
      })
    }).then(() => {
      let type = nodeType === 'passport'
        ? 'passport'
        : 'generic'

      return this.linkNodes(centerNode.uri, type, newNodeUri, false)
    }).then(() => {
      return newNodeUri.uri
    })
  }

  // Should we remove the ACL file associated with it as well?
  // PRO : we won't need the ACL file anymore
  // CON : it can be a parent ACL file, that would
  // result in other children loosing the ACL as well.
  deleteFile(uri) {
    return this.delete(Util.uriToProxied(uri))
  }

  storeFile(finUri, dstContainer, file, confidential = false) {
    let uri
    let wia = new WebIDAgent()
    const webId = wia.getWebId()

    if (!webId) {
      throw new Error('No webId detected.')
    }
    if (!finUri) {
      uri = `${dstContainer}files/${Util.randomString(5)}-${file.name}`
    } else {
      uri = finUri
    }
    return this.createACL(uri, webId, confidential).then(() => {
      return this.put(Util.uriToProxied(uri), file, {
        'Content-Type': 'image'
      }).then(() => {
        return uri
      }).catch((e) => {
        throw new Error('Could not upload the image')
      })
    })
  }

  // We create only one type of ACL file. Owner has full controll,
  // everyone else has read access. This will change in the future.
  // THIS WHOLE FUNCTION IS TERRIBLE, MAKE USE OF THE API TODO
  // PUT ACL and WRITE TRIPLE should be called after making sure that the user
  // has write access

  createACL(uri, webID, confidential = false) {
    let aclWriter = new Writer()
    let aclUri = `${uri}.acl`
    let owner = $rdf.sym('#owner')

    aclWriter.addTriple(owner, PRED.type, PRED.auth)
    aclWriter.addTriple(owner, PRED.access, $rdf.sym(uri))
    aclWriter.addTriple(owner, PRED.access, $rdf.sym(aclUri))
    aclWriter.addTriple(owner, PRED.agent, $rdf.sym(webID))

    aclWriter.addTriple(owner, PRED.mode, PRED.control)
    aclWriter.addTriple(owner, PRED.mode, PRED.read)
    aclWriter.addTriple(owner, PRED.mode, PRED.write)

    if (!confidential) {
      let all = $rdf.sym('#readall')

      aclWriter.addTriple(all, PRED.type, PRED.auth)
      aclWriter.addTriple(all, PRED.access, $rdf.sym(uri))
      aclWriter.addTriple(all, PRED.agentClass, PRED.Agent)
      aclWriter.addTriple(all, PRED.mode, PRED.read)
    }

    return this.put(Util.uriToProxied(aclUri), aclWriter.end(), {
      'Content-Type': 'text/turtle'
    }).then(() => {
      return aclUri
    }).catch((e) => {
      console.log('error', e, 'occured while putting the acl file')
    })
  }

  /**
   * @summary Adds a new triple to an $rdf file.
   * @params {object} uri - The uri of the file to add the triples to.
   * @params {array | object} triples - array of objets describing triples.
   * @params {boolean} draw - play the animation or not.
   * @return {function} fetch request - .then contains the response.
   */

  writeTriples(uri, triples, draw = false) {
    let validPredicate = false

    if (triples.length === 1) {
      let pred = triples[0].predicate.uri
      validPredicate = (pred === PRED.isRelatedTo.uri ||
        pred === PRED.knows.uri)
    }

    const toAdd = $rdf.graph()

    return new Promise((resolve, reject) => {
      for (let i = 0; i < triples.length; i++) {
        let t = triples[i]
        this.findTriples(t.subject.uri, t.subject, t.predicate, t.object)
          .then((res) => {
            if (res.length === 0) {
              toAdd.add(t.subject, t.predicate, t.object)
            } else {
              // Think about this
              return reject('DUPLICATE')
            }
            if (i === triples.length - 1) {
              return resolve()
            }
          })
      }
    }).then(() => {
      return this.patch(this._proxify(uri), null, toAdd.statements)
        .then((res) => {
          // At the moment the animation fires when we only add one triple.
          if (res.ok && draw && validPredicate) {
            let obj = triples[0].object.uri
            let pred = triples[0].predicate.uri
            // @TODO dont trigger actions from within the agents
            GraphActions.drawNewNode(obj, pred)
          }
        })
    })
  }

  /**
   * @summary Deletes a triple from an $rdf file.
   *
   * @param {string} uri -  the file we are removing from
   * @param {object} subject - subject of the triple we are deleting
   * @param {object} predicate - predicate of the triple we are deleting
   * @param {object} object - object of the triple we are deleting
   * Or
   * @param {object} {uri: uri, triples: [{subj,pred,obj}, {subj,pred,obj}..]}
   * @return {promise} fetch request - .then contains the response.
   */

  // uri,subj,pred,obj
  // {uri:uri, triples:[]}
  deleteTriple(...args) {
    let subject, predicate, object
    let triples = []
    let uri

    // Check if we received only one object with multiple triples in there.
    if (args.length === 1) {
      ({uri} = args[0])
      triples = args[0].triples
    } else {
      ([uri, subject, predicate, object] = args)
      triples = [{subject, predicate, object}]
    }

    const toDel = $rdf.graph()

    toDel.addAll(triples)

    return this.patch(this._proxify(uri), toDel.statements)
  }

  // This function gets passed a center uri and it's triples,
  // and then finds all possible links that we choose to display.
  // After that it parses those links for their RDF data.
  getNeighbours(center, triples) {
    // We will only follow and parse these links
    let Links = [
      PRED.knows.uri,
      PRED.isRelatedTo.uri,
      PRED.isRelatedTo_HTTP.uri,
      PRED.passport.uri
    ]
    let neighbours = triples.filter((t) => Links.indexOf(t.predicate.uri) >= 0)
    // If there are adjacent nodes to draw,
    // we parse them and return an array of their triples
    let neighbourErrors = []
    let graphMap = []

    return Promise.all(neighbours.map((triple) => {
      return this.fetchTriplesAtUri(triple.object.uri).then((result) => {
        // This is a node that coulnt't be retrieved, either 404, 401 etc.
        if (result.unav) {
          // We are setting the connection field of the node, we need it
          // in order to be able to dissconnect it from our center node later.

          neighbourErrors.push(triple.object.uri)

          // if forbidden access to node, do not show it
          // (we assume the center node isn't ours then)
          // @TODO find better way to know if we have rights to center node
          if (result.status !== 403) {
            result.connection = triple.predicate.uri
            graphMap.push(result)
          }
        } else {
          // This is a valid node.
          result.triples.connection = triple.predicate.uri
          graphMap.push(result.triples)
          graphMap[graphMap.length - 1].uri = triple.object.uri
        }
      }).catch(() => {
        neighbourErrors.push(triple.object.uri)
      })
    })).then(() => {
      return graphMap
    })
  }

  /**
   * @summary Given a uri, returns a JS object we can render
   *   describing the rdf file there.
   * @param {string} uri - The uri of the rdf file.
   * @return {object} node - JS object describing the node ready for render.
   */
  getFileModel(uri) {
    return this.fetchTriplesAtUri(uri).then(triples => {
      triples.triples.uri = uri
      return this.convertToNodes('a', [triples.triples])
    })
  }

  /**
   * @summary Given an array of triples, converts it to a JS object
   *  that is ready to be rendered.
   * @param {array | arrays} Triples - The triples describing the file.
   * @return {object} node - JS object describing the node ready for render.
   */
  convertToNodes(r, triples) {
    const convertor = new D3Convertor()
    const len = triples.length - 1
    let result = []
    triples.forEach((triple, i) => {
      result.push(convertor.convertToD3(r, triple, i, len))
    })

    return result
  }

  // Both getGraphMapAtUri and getGraphMapAtWebID return an array of nodes, each
  // node being represented as an array of triples that define it. The result
  // is pretty much a "map" of the currently displayed graph.

  getGraphMapAtUri(uri) {
    // centerNode is {prefixes: [...], triples: [...]}
    let getPartialGraphMap = (centerNode) => {
      return this.getNeighbours(uri, centerNode.triples)
        .then((neibTriples) => {
          let firstNode = centerNode.triples
          firstNode.uri = uri
          return [firstNode].concat(neibTriples)
        })
    }

    return this.fetchTriplesAtUri(uri)
      .then(getPartialGraphMap)
  }

  // Calls the above function, but passes the current webId as the URI.
  getGraphMapAtWebID(webId) {
    return this.getGraphMapAtUri(webId)
  }

  linkNodes(start, type, end, flag) {
    const predMap = {
      'generic': PRED.isRelatedTo,
      'knows': PRED.knows,
      'passport': PRED.passport
    }

    return Promise.all([
      this.head(this._proxify(start)),
      this.head(this._proxify(end))
    ]).then(() => {
      const predicate = predMap[type]
      let payload = {
        subject: $rdf.sym(start),
        predicate,
        object: $rdf.sym(end)
      }
      return this.gAgent.writeTriples(start, [payload], flag)
    })
  }
}

export default GraphAgent
