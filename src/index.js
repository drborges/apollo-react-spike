import React from "react";
import ReactDOM from "react-dom";
import gql from "graphql-tag";
import { ApolloClient } from "apollo-client";
import { HttpLink } from "apollo-link-http";
import { WebSocketLink } from "apollo-link-ws";
import { split } from "apollo-link";
import { getMainDefinition } from "apollo-utilities";
import { InMemoryCache } from "apollo-cache-inmemory";
import { graphql, ApolloProvider } from "react-apollo";

import "./styles.css";

/**
 * Extending the remote schema with a local one
 */
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

/**
 * Graphql documents definitions
 */
const TOGGLE_USER_BLOCK_STATE = gql`
  mutation ToggleUserBlockState($id: Int!) {
    toggleUserBlockState(id: $id) @client {
      id
      blocked @client
    }
  }
`;

/**
 * This setup can be simplified with apollo-boost
 */
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
  link: httpLink,
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
      toggleUserBlockState: (parent, { id }, { cache }) => {
        const data = cache.readQuery({ query: FETCH_USERS });
        const { users } = data;
        const userFromCache = users.find(u => u.id === id);

        userFromCache.blocked = !userFromCache.blocked;
        cache.writeQuery({ query: FETCH_USERS, data });
      }
    }
  }
});

// Initializes the cache with default data
cache.writeData({
  data: {
    users: []
  }
});

// These "with*" 'graphql' "connections" are similar to how one creates containers in Redux
const withToggleBlockStateMutation = graphql(TOGGLE_USER_BLOCK_STATE, {
  // Graphql query options with access to the incoming props
  options: props => ({
    variables: {
      id: props.user.id
    }
  }),
  // This allows transforming the props that will be passed
  // into the target component
  props: ({ ownProps, mutate }) => ({
    user: ownProps.user,
    onBlock: mutate
  })
});

const withUsersData = graphql(FETCH_USERS, {
  options: {
    fetchPolicy: "cache-and-network"
  }
});

const UserRowWithMutation = withToggleBlockStateMutation(props => {
  const { onBlock, user } = props;
  return (
    <li
      className={`item ${user.blocked ? "blocked" : "available"}`}
      onClick={onBlock}
    >
      {user.name} (#{user.id})
    </li>
  );
});

const UsersListWithData = withUsersData(({ data: { users } }) => {
  return (
    <ul>
      {users.map(user => (
        <UserRowWithMutation user={user} />
      ))}
    </ul>
  );
});

const App = () => {
  return (
    <ApolloProvider client={client}>
      <UsersListWithData />
    </ApolloProvider>
  );
};

const rootElement = document.getElementById("root");
ReactDOM.render(<App />, rootElement);

// subscribeToMore({
//   document: USER_SUBSCRIPTION,
//   updateQuery: (prev, { subscriptionData }) => {
//     console.log(">>>> Subscription received", prev);
//     if (!subscriptionData.data) {
//       return prev;
//     }

//     const newUser = subscriptionData.data.userAdded;
//     if (prev.users.find(user => user.id === newUser.id)) {
//       return prev;
//     }

//     return Object.assign({}, prev, {
//       users: [...prev.users, newUser]
//     });
//   }
// });
// const USER_SUBSCRIPTION = gql`
//   subscription onUserAdded {
//     userAdded {
//       id
//       name
//       email
//       age
//       blocked @client
//     }
//   }
// `;
