# -*- coding: utf-8 -*-

import os
import shutil

from rdflib import Graph, Literal, URIRef
from rdflib.namespace import Namespace, FOAF, DCTERMS, RDF


SIOC = Namespace('http://rdfs.org/sioc/ns#')

# Semantic Sensor Network ontology
SSN = Namespace('http://purl.oclc.org/NET/ssnx/ssn#')


class Person:
    def __init__(self, **kwargs):
        self.friend_webids = []
        self.__dict__.update(kwargs)


class SolidDataWriter:
    def __init__(self, blueprint, output_dir, flatten=False):
        self.blueprint = blueprint
        self.output_dir = output_dir
        self.flatten = flatten

    def _webid_url(self, server_location, person_id):
        return '{}/{}/profile/card#me'.format(server_location, person_id)

    def _container_base(self, server_name):
        if not self.flatten:
            return '{}/ldpc-{}'.format(self.output_dir, server_name)
        else:
            return self.output_dir

    def _write_server_container(self, server_dict):
        print('writing server {}'.format(server_dict['location']))
        container_dir = self._container_base(server_dict['name'])
        if os.path.exists(container_dir):
            shutil.rmtree(container_dir)
        os.makedirs(container_dir)

    def _write_person_container(self, person):
        '''
        Person container looks like this (inbox and card are rdf docs):
            └── justas
                ├── little-sister
                │   ├── graph-comments
                │   ├── graph-nodes
                │   ├── inbox
                │   └── sensor (optional)
                └── profile
                    └── card
        '''

        def profile_doc_content(has_sensor=False):
            graph = Graph()

            # WebID document URI
            doc_uri = URIRef('')

            # WebID URI
            webid_uri = URIRef('#me')

            graph.add((doc_uri, DCTERMS.title,
                       Literal('WebID profile of {}'.format(person.name))))

            # About doc
            graph.add((doc_uri, RDF.type, FOAF.PersonalProfileDocument))
            graph.add((doc_uri, FOAF.maker, webid_uri))
            graph.add((doc_uri, FOAF.primaryTopic, webid_uri))

            # About person
            graph.add((webid_uri, RDF.type, FOAF.Person))
            graph.add((webid_uri, FOAF.name, Literal(person.name)))
            graph.add((webid_uri, DCTERMS.description,
                       Literal(person.description)))

            if has_sensor:
                sensor_url = '{}/{}/little-sister/sensor#sensor'.format(
                    person.server_location,
                    person.id
                )

                graph.add((webid_uri, SIOC.container_of, URIRef(sensor_url)))

            for f in person.friend_webids:
                graph.add((webid_uri, FOAF.knows, URIRef(f)))

            return graph.serialize(format='turtle')

        def sensor_doc_content():
            # Initialize RDF graph
            payload = Graph()

            # Bind the required namespaces
            payload.bind('ssn', SSN)
            payload.bind('dc', DCTERMS)
            payload.bind('foaf', FOAF)

            # The document graph URI
            doc = URIRef('')

            # Sensor graph URI
            sensor = URIRef('#sensor')

            # Describe document graph and connect it to sensor graph
            payload.add((doc, RDF.type, FOAF.Document))
            payload.add((doc, DCTERMS.title, Literal('Sensor document')))
            payload.add((doc, FOAF.primaryTopic, sensor))

            # Describe sensor graph
            payload.add((sensor, RDF.type, SSN.Sensor))
            payload.add((sensor, SSN.observes, Literal('n/a')))
            payload.add((sensor, SSN.hasValue, Literal('n/a')))

            # Serialize the resulting graph
            return payload.serialize(format='turtle')

        def inbox_doc_content():
            graph = Graph()

            # inbox document URI
            doc_uri = URIRef('')

            # inbox URI
            inbox_uri = URIRef('#inbox')

            # WebID URI
            webid_uri = URIRef(person.webid)

            # About doc
            graph.add((doc_uri, DCTERMS.title,
                       Literal('Inbox of {}'.format(person.name))))

            graph.add((doc_uri, FOAF.maker, webid_uri))
            graph.add((doc_uri, FOAF.primaryTopic, inbox_uri))

            # About inbox
            graph.add((inbox_uri, RDF.type, SIOC.Space))

            return graph.serialize(format='turtle')

        print('writing person {}'.format(person.webid))
        # Assume that base container already exists
        base_c = self._container_base(person.server_name)

        person_c = '{}/{}'.format(base_c, person.id)
        os.makedirs(person_c)

        app_c = '{}/little-sister'.format(person_c)
        os.makedirs(app_c)

        app_comments_c = '{}/graph-comments'.format(app_c)
        os.makedirs(app_comments_c)

        app_nodes_c = '{}/graph-nodes'.format(app_c)
        os.makedirs(app_nodes_c)

        profile_c = '{}/profile'.format(person_c)
        os.makedirs(profile_c)

        inbox_doc = '{}/inbox'.format(app_c)
        with open(inbox_doc, 'w') as f:
            f.write(inbox_doc_content())

        has_sensor = 'sensor' in person.__dict__ and person.sensor
        if has_sensor:
            sensor_doc = '{}/sensor'.format(app_c)
            with open(sensor_doc, 'w') as f:
                f.write(sensor_doc_content())

        webid_doc = '{}/card'.format(profile_c)
        with open(webid_doc, 'w') as f:
            f.write(profile_doc_content(has_sensor))

    def write_containers(self):
        '''Generates LDP containers and resources from self.blueprint'''

        people_dict = {}
        for s in self.blueprint['servers']:
            for p_dict in s['people']:
                p_obj = Person(**p_dict)
                p_obj.server_location = s['location']
                p_obj.server_name = s['name']
                people_dict[p_dict['id']] = p_obj
            self._write_server_container(s)

        for p in people_dict.itervalues():
            p.webid = self._webid_url(p.server_location, p.id)
            for fid in p.friends:
                f = people_dict[fid]
                p.friend_webids.append(self._webid_url(f.server_location, f.id))
                # Backlinks
                if p.id not in f.friends:
                    f.friend_webids.append(self._webid_url(p.server_location,
                                                           p.id))
            self._write_person_container(p)
