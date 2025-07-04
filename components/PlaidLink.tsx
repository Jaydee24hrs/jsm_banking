import React, { useCallback, useEffect, useState } from 'react'
import { Button } from './ui/button'
import { PlaidLinkOnSuccess, PlaidLinkOptions, usePlaidLink } from 'react-plaid-link'
import { useRouter } from 'next/navigation';
import { createLinkToken, exchangePublicToken } from '@/lib/actions/user.actions';
import Image from 'next/image';

const PlaidLink = ({ user, variant }: PlaidLinkProps) => {
  const router = useRouter();

  const [token, setToken] = useState('');

  // useEffect(() => {
  //   const getLinkToken = async () => {
  //     const data = await createLinkToken(user);

  //     setToken(data?.linkToken);
  //   }

  //   getLinkToken();
  // }, [user]);

  const onSuccess = useCallback<PlaidLinkOnSuccess>(async (public_token: string) => {
    await exchangePublicToken({
      publicToken: public_token,
      user,
    });

    router.push('/');
  }, [user, router]); // Add 'router' to the dependency array
  
  const config: PlaidLinkOptions = {
    token,
    onSuccess
  }

  // const { open, ready } = usePlaidLink(config);
  
  return (
    <>
      {variant === 'primary' ? (
        <Button
          // onClick={() => open()}
          disabled={!ready}
          className="plaidlink-primary rounded-[3rem]"
        >
          Connect bank
        </Button>
      ): variant === 'ghost' ? (
        <Button variant="ghost" className="plaidlink-ghost rounded-[3rem]">
          <Image 
            src="/icons/connect-bank.svg"
            alt="connect bank"
            width={24}
            height={24}
          />
          <p className='hiddenl text-[16px]  font-semibold text-black-2 xl:block'>Connect bank</p>
        </Button>
      ): (
        <Button className="plaidlink-default rounded-[3rem]">
          <Image 
            src="/icons/connect-bank.svg"
            alt="connect bank"
            width={24}
            height={24}
          />
          <p className='text-[16px] font-semibold text-black-2'>Connect bank</p>
        </Button>
      )}
    </>
  )
}

export default PlaidLink