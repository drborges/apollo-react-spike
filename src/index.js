import React from "react";
import ReactDOM from "react-dom";
import gql from "graphql-tag";
import { ApolloClient } from "apollo-client";
import { HttpLink } from 'apollo-link-http';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { ApolloProvider, ApolloConsumer, Query, Mutation } from "react-apollo";

import "./styles.css";

export const typeDefs = gql`
  extend type User {
    blocked: Boolean!
  }

  extend type Mutation {
    toggleUserBlockState(id: Int!): User!
  }
`

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
`

const TOGGLE_USER_BLOCK_STATE = gql`
  mutation ToggleUserBlockState($id: Int!) {
    toggleUserBlockState(id: $id) @client {
      id
      blocked @client
    }
  }
`

const cache = new InMemoryCache()
const link = new HttpLink({
  uri: "https://b1a56f31.ngrok.io/graphql",
})

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
        const userFromCache = users.find(u => u.id === user.id)
        return userFromCache !== undefined && userFromCache.blocked
      },
    },
    Mutation: {
      toggleUserBlockState: (user, { id }, { cache }) => {
        const data = cache.readQuery({ query: FETCH_USERS })
        const { users } = data
        const userFromCache = users.find(u => u.id === id)
        userFromCache.blocked = !userFromCache.blocked
        cache.writeQuery({ query: FETCH_USERS, data })
      }
    }
  },
})

cache.writeData({
  data: {
    users: [],
  },
});


function App() {
  return (
    <ApolloProvider client={client}>
      <Query
          query={FETCH_USERS}
          fetchPolicy="network-only"
      >
        {({ loading, error, data, refetch }) => {
          if (loading) return <li>Loading...</li>;
          if (error) return <li>Error :(</li>;

          return (
            <div className="App">
              <ul>
                {data.users.map(user => (
                  <Mutation
                    mutation={TOGGLE_USER_BLOCK_STATE}
                    variables={{ id: user.id }}
                    refetchQueries={FETCH_USERS}
                  >
                    {mutate => (
                      <li
                          key={user.id}
                          className={`item ${user.blocked ? "blocked" : "available"}`}
                          onClick={mutate}
                      >
                        {user.name}
                      </li>
                    )}
                  </Mutation>
                ))}
              </ul>
              <button type="button" onClick={() => refetch()}>Refresh</button>
            </div>
          )
        }}
      </Query>
    </ApolloProvider>
  );
}

const rootElement = document.getElementById("root");
ReactDOM.render(<App />, rootElement);














