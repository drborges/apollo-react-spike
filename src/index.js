import React from "react";
import ReactDOM from "react-dom";
import gql from "graphql-tag";
import { ApolloClient } from "apollo-client";
import { HttpLink } from "apollo-link-http";
import { WebSocketLink } from "apollo-link-ws";
import { split } from "apollo-link";
import { getMainDefinition } from "apollo-utilities";
import { InMemoryCache } from "apollo-cache-inmemory";
import { ApolloProvider, Query, Mutation, Subscription } from "react-apollo";

import "./styles.css";

export const typeDefs = gql`
  extend type User {
    blocked: Boolean!
  }

  extend type Mutation {
    toggleUserBlockState(id: Int!): User!
  }
`;

const FETCH_USERS = gql`
  query FetchUsers {
    users {
      id
      name
      email
      age
      blocked @client
    }
  }
`;

const TOGGLE_USER_BLOCK_STATE = gql`
  mutation ToggleUserBlockState($id: Int!) {
    toggleUserBlockState(id: $id) @client {
      id
      blocked @client
    }
  }
`;

const USER_SUBSCRIPTION = gql`
  subscription onUserAdded {
    userAdded {
      id
      name
      email
      age
      blocked @client
    }
  }
`;

const cache = new InMemoryCache();
const sandboxId = "kop4j51nkr";
const wsLink = new WebSocketLink({
  uri: `wss://${sandboxId}.sse.codesandbox.io/graphql`,
  options: {
    reconnect: true
  }
});

const httpLink = new HttpLink({
  uri: `https://${sandboxId}.sse.codesandbox.io/graphql`
});

// using the ability to split links, you can send data to each link
// depending on what kind of operation is being sent
const link = split(
  // split based on operation type
  ({ query }) => {
    const { kind, operation } = getMainDefinition(query);
    return kind === "OperationDefinition" && operation === "subscription";
  },
  wsLink,
  httpLink
);

const client = new ApolloClient({
  link,
  cache,
  // Register a local schema which extends the remote one with local state.
  typeDefs,
  // Local resolvers implement the local state management logic for fields
  // marked with @client (including mutations).
  resolvers: {
    User: {
      blocked: (user, _, { cache }) => {
        const { users } = cache.readQuery({ query: FETCH_USERS });
        const userFromCache = users.find(u => u.id === user.id);
        return userFromCache !== undefined && userFromCache.blocked;
      }
    },
    Mutation: {
      toggleUserBlockState: (user, { id }, { cache }) => {
        const data = cache.readQuery({ query: FETCH_USERS });
        const { users } = data;
        const userFromCache = users.find(u => u.id === id);
        userFromCache.blocked = !userFromCache.blocked;
        cache.writeQuery({ query: FETCH_USERS, data });
      }
    }
  }
});

cache.writeData({
  data: {
    users: []
  }
});

const App = () => {
  return (
    <ApolloProvider client={client}>
      <ul>
        <Query query={FETCH_USERS} fetchPolicy="network-only">
          {({ loading, error, data, subscribeToMore }) => {
            if (loading) return <li>Loading...</li>;
            if (error) return <li>Error :(</li>;

            subscribeToMore({
              document: USER_SUBSCRIPTION,
              updateQuery: (prev, { subscriptionData }) => {
                console.log(">>>> Subscription received", prev);
                if (!subscriptionData.data) return prev;
                const newUser = subscriptionData.data.userAdded;
                if (prev.users.find(user => user.id === newUser.id))
                  return prev;

                return Object.assign({}, prev, {
                  users: [...prev.users, newUser]
                });
              }
            });

            return data.users.map(user => (
              <Mutation
                key={user.id}
                mutation={TOGGLE_USER_BLOCK_STATE}
                variables={{ id: user.id }}
              >
                {mutate => (
                  <li
                    className={`item ${user.blocked ? "blocked" : "available"}`}
                    onClick={mutate}
                  >
                    {user.name} (#{user.id})
                  </li>
                )}
              </Mutation>
            ));
          }}
        </Query>
      </ul>
    </ApolloProvider>
  );
};

const rootElement = document.getElementById("root");
ReactDOM.render(<App />, rootElement);
