"use server";

import { cookies } from "next/headers";
import { ID, Query } from "node-appwrite";
import { createAdminClient, createSessionClient } from "../appwrite";
import { encryptId, extractCustomerIdFromUrl, parseStringify } from "../utils";
import { Products, CountryCode, ProcessorTokenCreateRequest, ProcessorTokenCreateRequestProcessorEnum } from "plaid";
import { plaidClient } from "../plaid";
import { revalidatePath } from "next/cache";

import { addFundingSource, createDwollaCustomer } from "./dwolla.actions";

const {
  APPWRITE_DATABASE_ID,
  APPWRITE_USER_COLLECTION_ID,
  APPWRITE_BANK_COLLECTION_ID
} = process.env;

const DATABASE_ID = APPWRITE_DATABASE_ID || '685dadcd001f66032dba';
const USER_COLLECTION_ID = APPWRITE_USER_COLLECTION_ID || '685db0360037804f783e';
const BANK_COLLECTION_ID = APPWRITE_BANK_COLLECTION_ID || '685db0bc0031a63bc87e';


export const getUserInfo = async ({ userId }: getUserInfoProps) => {
  try {
    const { database } = await createAdminClient();

    const user = await database.listDocuments(
      DATABASE_ID!,
      USER_COLLECTION_ID!,
      [Query.equal('userId', [userId])]
    )

    return parseStringify(user.documents[0]);
  } catch (error) {
    console.log(error)
  }
}

export const signIn = async ({ email, password }: { email: string; password: string }) => {
  try {
    const { account } = await createAdminClient();
    const session = await account.createEmailPasswordSession(email, password);

    cookies().set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: true,
    });

    const user = await getUserInfo({ userId: session.userId }) 

    return parseStringify(user);
  } catch (error) {
    console.error("Sign in error:", error);
    return { success: false, error: "Invalid credentials. Please try again." };
  }
};

// export const signUp = async ({ password, ...userData }: SignUpParams) => {
//   const { email, firstName, lastName } = userData;

//   let newUserAccount;

//   try {
//     const { account, database } = await createAdminClient();

//     newUserAccount = await account.create(
//       ID.unique(),
//       email,
//       password,
//       `${firstName} ${lastName}`
//     );

//     if(!newUserAccount) throw new Error('Error creating user')

//       const dwollaCustomerUrl = await createDwollaCustomer({
//         ...userData,
//         type: 'personal'
//       })
  
//       if(!dwollaCustomerUrl) throw new Error('Error creating Dwolla customer')
  
//       const dwollaCustomerId = extractCustomerIdFromUrl(dwollaCustomerUrl);
  
//       const newUser = await database.createDocument(
//         DATABASE_ID!,
//         USER_COLLECTION_ID!,
//         ID.unique(),
//         {
//           ...userData,
//           userId: newUserAccount.$id,
//           dwollaCustomerId,
//           dwollaCustomerUrl
//         }
//       )

//     const session = await account.createEmailPasswordSession(email, password);

//     cookies().set("appwrite-session", session.secret, {
//       path: "/",
//       httpOnly: true,
//       sameSite: "strict",
//       secure: true,
//     });

//     return parseStringify(newUser);
//   } catch (error) {
//     console.error("Error creating user account:", error);
//     throw new Error("Sign-up failed. Please try again later.");
//   }
// };



export const signUp = async ({ password, ...userData }: SignUpParams) => {
  const { email, firstName, lastName } = userData;

  try {
    console.log("Creating admin client...");
    const { account, database } = await createAdminClient();

    console.log("Creating Appwrite user...");
    const newUserAccount = await account.create(
      ID.unique(),
      email,
      password,
      `${firstName} ${lastName}`
    );

    if (!newUserAccount) throw new Error("Error creating user");

    console.log("Creating database document...");
    const newUser = await database.createDocument(
      DATABASE_ID!,
      USER_COLLECTION_ID!,
      ID.unique(),
      {
        ...userData,
        userId: newUserAccount.$id,
      }
    );

    console.log("Creating session...");
    const session = await account.createEmailPasswordSession(email, password);

    cookies().set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: true,
    });

    return parseStringify(newUser);
  } catch (error) {
    console.error("🔴 Sign-up error:", error);
    throw new Error("Sign-up failed. Please try again later.");
  }
};



export async function getLoggedInUser() {
  try {
    const { account } = await createSessionClient();
    const result = await account.get();
    const user = await getUserInfo({ userId: result.$id})

    return parseStringify(user);
  } catch (error) {
    console.log(error)
    return null;
  }
}

export const signOut = async () => {
  try {
    const { account } = await createSessionClient();

    cookies().delete("appwrite-session");
    await account.deleteSession("current");

    return { success: true };
  } catch (error) {
    console.error("Sign out error:", error);
    return { success: false, error: "Unable to sign out. Please try again." };
  }
};

export const logoutAccount = async () => {
  try {
    const { account } = await createSessionClient();

    cookies().delete('appwrite-session');

    await account.deleteSession('current');
  } catch  {
    return null;
  }
}

export const createBankAccount = async ({
  userId,
  bankId,
  accountId,
  accessToken,
  fundingSourceUrl,
  shareableId,
}: createBankAccountProps) => {
  try {
    const { database } = await createAdminClient();

    const bankAccount = await database.createDocument(
      DATABASE_ID!,
      BANK_COLLECTION_ID!,
      ID.unique(),
      {
        userId,
        bankId,
        accountId,
        accessToken,
        fundingSourceUrl,
        shareableId,
      }
    )

    return parseStringify(bankAccount);
  } catch (error) {
    console.log(error);
  }
}

// export const createLinkToken = async (user: User) => {
//   try {
//     const tokenParams = {
//       user: {
//         client_user_id: user.$id
//       },
//       client_name: `${user.firstName} ${user.lastName}`,
//       products: ['auth'] as Products[],
//       language: 'en',
//       country_codes: ['US'] as CountryCode[],
//     }

//     const response = await plaidClient.linkTokenCreate(tokenParams);
    
//     return parseStringify({ linkToken: response.data.link_token })
//   } catch (error) {
//     console.log(error);
//   }
// }

export const createLinkToken = async (user: User) => {
  try {
    // Create a link token PARAMS
    const tokenParams = {
      client_name: `${user.firstName} ${user.lastName}`,
      products: [Products.Auth, Products.Transactions],

      country_codes: [CountryCode.Us],
      language: 'en',
      user: {
        client_user_id: user.$id,
      },
    };
    const response = await plaidClient.linkTokenCreate(tokenParams);
    return parseStringify({linkToken: response.data.link_token});
  } catch (error) {
    console.error('Error creating link token:', error);
    return null;
  }
};

export const exchangePublicToken = async ({

  publicToken,
  user,
}: exchangePublicTokenProps) => {
  try {
    // Exchange public token for access token and item ID
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;
    
    // Get account information from Plaid using the access token
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    const accountData = accountsResponse.data.accounts[0];

    // Create a processor token for Dwolla using the access token and account ID
    const request: ProcessorTokenCreateRequest = {
      access_token: accessToken,
      account_id: accountData.account_id,
      processor: "dwolla" as ProcessorTokenCreateRequestProcessorEnum,
    };

    const processorTokenResponse = await plaidClient.processorTokenCreate(request);
    const processorToken = processorTokenResponse.data.processor_token;

     // Create a funding source URL for the account using the Dwolla customer ID, processor token, and bank name
     const fundingSourceUrl = await addFundingSource({
      dwollaCustomerId: user.dwollaCustomerId,
      processorToken,
      bankName: accountData.name,
    });
    
    // If the funding source URL is not created, throw an error
    if (!fundingSourceUrl) throw Error;

    // Create a bank account using the user ID, item ID, account ID, access token, funding source URL, and shareableId ID
    await createBankAccount({
      userId: user.$id,
      bankId: itemId,
      accountId: accountData.account_id,
      accessToken,
      fundingSourceUrl,
      shareableId: encryptId(accountData.account_id),
    });

    // Revalidate the path to reflect the changes
    revalidatePath("/");

    // Return a success message
    return parseStringify({
      publicTokenExchange: "complete",
    });
  } catch (error) {
    console.error("An error occurred while creating exchanging token:", error);
  }
}

export const getBanks = async ({ userId }: getBanksProps) => {
  try {
    const { database } = await createAdminClient();

    const banks = await database.listDocuments(
      DATABASE_ID!,
      BANK_COLLECTION_ID!,
      [Query.equal('userId', [userId])]
    )

    return parseStringify(banks.documents);
  } catch (error) {
    console.log(error)
  }
}

export const getBank = async ({ documentId }: getBankProps) => {
  try {
    const { database } = await createAdminClient();

    const bank = await database.listDocuments(
      DATABASE_ID!,
      BANK_COLLECTION_ID!,
      [Query.equal('$id', [documentId])]
    )

    return parseStringify(bank.documents[0]);
  } catch (error) {
    console.log(error)
  }
}

export const getBankByAccountId = async ({ accountId }: getBankByAccountIdProps) => {
  try {
    const { database } = await createAdminClient();

    const bank = await database.listDocuments(
      DATABASE_ID!,
      BANK_COLLECTION_ID!,
      [Query.equal('accountId', [accountId])]
    )

    if(bank.total !== 1) return null;

    return parseStringify(bank.documents[0]);
  } catch (error) {
    console.log(error)
  }
}